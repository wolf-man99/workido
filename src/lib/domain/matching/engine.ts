/**
 * Workido matching engine (MVP).
 *
 * A transparent, deterministic rules-based ranking. It does NOT use AI or
 * any third-party service. Documented in docs/MATCHING.md.
 *
 * 1. Eligibility - hard filters that exclude a specialist entirely.
 * 2. Scoring - weighted components. A component only counts when the data
 *    needed to evaluate it exists ("applicable"); missing data is omitted
 *    from both the numerator and the denominator rather than being awarded
 *    free points. The final score is normalised to 0-100.
 * 3. Reasons - short, positive, buyer-facing explanations. Raw component
 *    scores are internal and never shown to buyers or specialists.
 *
 * New specialists are never excluded for having no reviews or orders: the
 * reliability component is simply not applicable until enough data exists.
 */

export type Availability = "available" | "busy" | "unavailable";
export type Experience = "entry" | "intermediate" | "expert";
export type Urgency = "flexible" | "standard" | "urgent";

export interface MatchRequirement {
  /** Requirement category plus its subcategory/children: the "relevant" set. */
  categoryIds: string[];
  categoryName: string;
  skills: { skillId: string; mandatory: boolean }[];
  budgetMaxMinor: number | null;
  deadlineAt: Date | null;
  urgency: Urgency;
  preferredExperience: Experience | null;
  now: Date;
}

export interface MatchCandidate {
  specialistId: string;
  isPublished: boolean;
  accountStatus: "active" | "suspended";
  availability: Availability;
  verificationStatus: "not_submitted" | "pending" | "verified" | "rejected";
  experienceLevel: Experience | null;
  skillIds: string[];
  /** Categories declared by the specialist or implied by their skills. */
  categoryIds: string[];
  /** Categories in which the specialist has published services. */
  serviceCategoryIds: string[];
  minPriceInCategoryMinor: number | null;
  minPriceAnyMinor: number | null;
  minDeliveryInCategoryHours: number | null;
  minDeliveryAnyHours: number | null;
  portfolioInCategory: number;
  portfolioTotal: number;
  completedOrders: number;
  onTimeRate: number | null;
  onTimeSample: number;
  cancellationRate: number | null;
  cancellationSample: number;
}

export interface MatchWeights {
  skills: number;
  category: number;
  availability: number;
  budget: number;
  portfolio: number;
  reliability: number;
  verification: number;
  experience: number;
}

/**
 * Default product weights. These are tunable parameters, not fixed business
 * rules. The six core weights follow the original brief (30/20/15/15/10/10);
 * verification and experience preference are small configurable extras.
 */
export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  skills: 30,
  category: 20,
  availability: 15,
  budget: 15,
  portfolio: 10,
  reliability: 10,
  verification: 5,
  experience: 5,
};

/** Minimum number of relevant orders before reliability is scored at all. */
export const MIN_RELIABILITY_SAMPLE = 3;

/** A starting price up to this multiple of the budget earns partial budget points. */
export const BUDGET_STRETCH_FACTOR = 1.25;

export type ExclusionReason =
  | "profile_unpublished"
  | "account_suspended"
  | "unavailable"
  | "busy_for_urgent_task"
  | "missing_mandatory_skills"
  | "cannot_meet_deadline";

export type Eligibility = { eligible: true } | { eligible: false; reason: ExclusionReason };

export type ComponentKey = keyof MatchWeights;

export interface ComponentScore {
  earned: number;
  max: number;
}

export interface ScoredMatch {
  specialistId: string;
  score: number;
  label: "Strong match" | "Good match" | "Possible match";
  reasons: string[];
  components: Partial<Record<ComponentKey, ComponentScore>>;
}

export interface RankResult {
  matches: ScoredMatch[];
  excluded: { specialistId: string; reason: ExclusionReason }[];
}

function hoursUntil(deadline: Date, now: Date): number {
  return (deadline.getTime() - now.getTime()) / 3_600_000;
}

function fastestDelivery(candidate: MatchCandidate): number | null {
  return candidate.minDeliveryInCategoryHours ?? candidate.minDeliveryAnyHours;
}

function intersects(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(b);
  return a.some((value) => set.has(value));
}

const EXPERIENCE_RANK: Record<Experience, number> = { entry: 0, intermediate: 1, expert: 2 };

export function checkEligibility(requirement: MatchRequirement, candidate: MatchCandidate): Eligibility {
  if (!candidate.isPublished) return { eligible: false, reason: "profile_unpublished" };
  if (candidate.accountStatus !== "active") return { eligible: false, reason: "account_suspended" };
  if (candidate.availability === "unavailable") return { eligible: false, reason: "unavailable" };
  // Urgent tasks are effectively instant hires: busy specialists are skipped.
  if (requirement.urgency === "urgent" && candidate.availability === "busy") {
    return { eligible: false, reason: "busy_for_urgent_task" };
  }

  const candidateSkills = new Set(candidate.skillIds);
  const missingMandatory = requirement.skills.some((skill) => skill.mandatory && !candidateSkills.has(skill.skillId));
  if (missingMandatory) return { eligible: false, reason: "missing_mandatory_skills" };

  // Only exclude on delivery time when we actually know both sides.
  const fastest = fastestDelivery(candidate);
  if (requirement.deadlineAt && fastest !== null && hoursUntil(requirement.deadlineAt, requirement.now) < fastest) {
    return { eligible: false, reason: "cannot_meet_deadline" };
  }

  return { eligible: true };
}

export function scoreCandidate(
  requirement: MatchRequirement,
  candidate: MatchCandidate,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): ScoredMatch {
  const components: Partial<Record<ComponentKey, ComponentScore>> = {};
  const reasons: string[] = [];
  const add = (key: ComponentKey, fraction: number) => {
    const max = weights[key];
    if (max <= 0) return;
    components[key] = { earned: max * Math.min(1, Math.max(0, fraction)), max };
  };

  // Skills: share of the requested skills the specialist has.
  if (requirement.skills.length > 0) {
    const candidateSkills = new Set(candidate.skillIds);
    const matched = requirement.skills.filter((skill) => candidateSkills.has(skill.skillId)).length;
    add("skills", matched / requirement.skills.length);
    if (matched === requirement.skills.length) {
      reasons.push(matched === 1 ? "Has the skill you asked for" : `Matches all ${matched} skills you asked for`);
    } else if (matched > 0) {
      reasons.push(`Matches ${matched} of ${requirement.skills.length} skills you asked for`);
    }
  }

  // Category: a published service in the category beats a declared interest.
  if (intersects(candidate.serviceCategoryIds, requirement.categoryIds)) {
    add("category", 1);
    reasons.push(`Offers services in ${requirement.categoryName}`);
  } else if (intersects(candidate.categoryIds, requirement.categoryIds)) {
    add("category", 0.75);
    reasons.push(`Works in ${requirement.categoryName}`);
  } else {
    add("category", 0);
  }

  // Availability & delivery fit.
  const availabilityFactor = candidate.availability === "available" ? 1 : 0.5;
  let deliveryFactor = 1;
  const fastest = fastestDelivery(candidate);
  if (requirement.deadlineAt && fastest !== null) {
    const slack = hoursUntil(requirement.deadlineAt, requirement.now) / fastest;
    deliveryFactor = slack >= 2 ? 1 : 0.7;
    reasons.push("Can deliver within your timeframe");
  }
  add("availability", availabilityFactor * deliveryFactor);
  if (candidate.availability === "available") reasons.push("Available now");

  // Budget: only when both the budget and a comparable price are known.
  const price = candidate.minPriceInCategoryMinor ?? candidate.minPriceAnyMinor;
  if (requirement.budgetMaxMinor !== null && price !== null) {
    if (price <= requirement.budgetMaxMinor) {
      add("budget", 1);
      reasons.push("Starting price fits your budget");
    } else if (price <= requirement.budgetMaxMinor * BUDGET_STRETCH_FACTOR) {
      add("budget", 0.4);
    } else {
      add("budget", 0);
    }
  }

  // Portfolio evidence.
  if (candidate.portfolioInCategory > 0) {
    add("portfolio", 1);
    reasons.push("Relevant portfolio available");
  } else if (candidate.portfolioTotal > 0) {
    add("portfolio", 0.4);
  } else {
    add("portfolio", 0);
  }

  // Reliability: only with enough real history (never invented).
  const reliabilitySignals: number[] = [];
  if (candidate.onTimeRate !== null && candidate.onTimeSample >= MIN_RELIABILITY_SAMPLE) {
    reliabilitySignals.push(candidate.onTimeRate);
    if (candidate.onTimeRate >= 0.9) reasons.push("Consistently delivers on time");
  }
  if (candidate.cancellationRate !== null && candidate.cancellationSample >= MIN_RELIABILITY_SAMPLE) {
    reliabilitySignals.push(1 - candidate.cancellationRate);
  }
  if (reliabilitySignals.length > 0) {
    add("reliability", reliabilitySignals.reduce((sum, value) => sum + value, 0) / reliabilitySignals.length);
  }

  // Verification (admin-reviewed).
  add("verification", candidate.verificationStatus === "verified" ? 1 : 0);
  if (candidate.verificationStatus === "verified") reasons.push("Verified specialist");

  // Experience preference, when the buyer stated one.
  if (requirement.preferredExperience) {
    if (candidate.experienceLevel === null) {
      add("experience", 0);
    } else {
      const gap = EXPERIENCE_RANK[requirement.preferredExperience] - EXPERIENCE_RANK[candidate.experienceLevel];
      add("experience", gap <= 0 ? 1 : gap === 1 ? 0.5 : 0);
      if (gap <= 0) reasons.push("Matches your preferred experience level");
    }
  }

  const totals = Object.values(components).reduce(
    (acc, component) => ({ earned: acc.earned + component.earned, max: acc.max + component.max }),
    { earned: 0, max: 0 },
  );
  const score = totals.max === 0 ? 0 : Math.round((totals.earned / totals.max) * 1000) / 10;

  return {
    specialistId: candidate.specialistId,
    score,
    label: matchLabel(score),
    reasons,
    components,
  };
}

/** Qualitative label shown to buyers instead of the raw score. */
export function matchLabel(score: number): ScoredMatch["label"] {
  return score >= 75 ? "Strong match" : score >= 55 ? "Good match" : "Possible match";
}

export function rankCandidates(
  requirement: MatchRequirement,
  candidates: MatchCandidate[],
  options: { weights?: MatchWeights; limit?: number; minScore?: number } = {},
): RankResult {
  const weights = options.weights ?? DEFAULT_MATCH_WEIGHTS;
  const limit = options.limit ?? 8;
  const minScore = options.minScore ?? 25;
  const excluded: RankResult["excluded"] = [];
  const scored: { match: ScoredMatch; candidate: MatchCandidate }[] = [];

  for (const candidate of candidates) {
    const eligibility = checkEligibility(requirement, candidate);
    if (!eligibility.eligible) {
      excluded.push({ specialistId: candidate.specialistId, reason: eligibility.reason });
      continue;
    }
    scored.push({ match: scoreCandidate(requirement, candidate, weights), candidate });
  }

  // Deterministic ordering: score, then real completed work, then id.
  scored.sort(
    (a, b) =>
      b.match.score - a.match.score ||
      b.candidate.completedOrders - a.candidate.completedOrders ||
      a.candidate.specialistId.localeCompare(b.candidate.specialistId),
  );

  return {
    matches: scored
      .map((entry) => entry.match)
      .filter((match) => match.score >= minScore)
      .slice(0, limit),
    excluded,
  };
}
