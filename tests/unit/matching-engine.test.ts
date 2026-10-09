import { describe, expect, it } from "vitest";
import {
  DEFAULT_MATCH_WEIGHTS,
  checkEligibility,
  rankCandidates,
  scoreCandidate,
  type MatchCandidate,
  type MatchRequirement,
} from "@/lib/domain/matching/engine";

const NOW = new Date("2026-10-09T10:00:00Z");

function requirement(overrides: Partial<MatchRequirement> = {}): MatchRequirement {
  return {
    categoryIds: ["cat-design"],
    categoryName: "Graphic Design",
    skills: [
      { skillId: "skill-carousel", mandatory: false },
      { skillId: "skill-canva", mandatory: false },
    ],
    budgetMaxMinor: 200000,
    deadlineAt: new Date("2026-10-14T10:00:00Z"), // 120 hours away
    urgency: "standard",
    preferredExperience: null,
    now: NOW,
    ...overrides,
  };
}

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    specialistId: "spec-a",
    isPublished: true,
    accountStatus: "active",
    availability: "available",
    verificationStatus: "not_submitted",
    experienceLevel: "intermediate",
    skillIds: ["skill-carousel", "skill-canva"],
    categoryIds: ["cat-design"],
    serviceCategoryIds: ["cat-design"],
    minPriceInCategoryMinor: 150000,
    minPriceAnyMinor: 150000,
    minDeliveryInCategoryHours: 48,
    minDeliveryAnyHours: 48,
    portfolioInCategory: 2,
    portfolioTotal: 3,
    completedOrders: 0,
    onTimeRate: null,
    onTimeSample: 0,
    cancellationRate: null,
    cancellationSample: 0,
    ...overrides,
  };
}

describe("eligibility", () => {
  it("accepts a complete, available specialist", () => {
    expect(checkEligibility(requirement(), candidate())).toEqual({ eligible: true });
  });

  it("excludes unpublished, suspended and unavailable specialists", () => {
    expect(checkEligibility(requirement(), candidate({ isPublished: false }))).toEqual({ eligible: false, reason: "profile_unpublished" });
    expect(checkEligibility(requirement(), candidate({ accountStatus: "suspended" }))).toEqual({ eligible: false, reason: "account_suspended" });
    expect(checkEligibility(requirement(), candidate({ availability: "unavailable" }))).toEqual({ eligible: false, reason: "unavailable" });
  });

  it("excludes busy specialists only for urgent tasks", () => {
    expect(checkEligibility(requirement(), candidate({ availability: "busy" })).eligible).toBe(true);
    expect(checkEligibility(requirement({ urgency: "urgent" }), candidate({ availability: "busy" }))).toEqual({
      eligible: false,
      reason: "busy_for_urgent_task",
    });
  });

  it("excludes specialists missing a mandatory skill", () => {
    const req = requirement({ skills: [{ skillId: "skill-motion", mandatory: true }] });
    expect(checkEligibility(req, candidate())).toEqual({ eligible: false, reason: "missing_mandatory_skills" });
    expect(checkEligibility(req, candidate({ skillIds: ["skill-motion"] })).eligible).toBe(true);
  });

  it("does not exclude for missing optional skills", () => {
    const req = requirement({ skills: [{ skillId: "skill-motion", mandatory: false }] });
    expect(checkEligibility(req, candidate()).eligible).toBe(true);
  });

  it("excludes specialists who cannot meet the deadline", () => {
    const req = requirement({ deadlineAt: new Date("2026-10-10T10:00:00Z") }); // 24h away
    expect(checkEligibility(req, candidate({ minDeliveryInCategoryHours: 48 }))).toEqual({
      eligible: false,
      reason: "cannot_meet_deadline",
    });
    expect(checkEligibility(req, candidate({ minDeliveryInCategoryHours: 12 })).eligible).toBe(true);
  });

  it("does not exclude on deadline when delivery time is unknown", () => {
    const req = requirement({ deadlineAt: new Date("2026-10-10T10:00:00Z") });
    expect(checkEligibility(req, candidate({ minDeliveryInCategoryHours: null, minDeliveryAnyHours: null })).eligible).toBe(true);
  });
});

describe("scoring", () => {
  it("rewards skill overlap", () => {
    const full = scoreCandidate(requirement(), candidate());
    const half = scoreCandidate(requirement(), candidate({ skillIds: ["skill-carousel"] }));
    const none = scoreCandidate(requirement(), candidate({ skillIds: [] }));
    expect(full.score).toBeGreaterThan(half.score);
    expect(half.score).toBeGreaterThan(none.score);
    expect(full.reasons).toContain("Matches all 2 skills you asked for");
    expect(half.reasons).toContain("Matches 1 of 2 skills you asked for");
  });

  it("prefers specialists with services in the category", () => {
    const service = scoreCandidate(requirement(), candidate());
    const declared = scoreCandidate(requirement(), candidate({ serviceCategoryIds: [] }));
    const other = scoreCandidate(requirement(), candidate({ serviceCategoryIds: ["cat-video"], categoryIds: ["cat-video"] }));
    expect(service.score).toBeGreaterThan(declared.score);
    expect(declared.score).toBeGreaterThan(other.score);
    expect(service.reasons).toContain("Offers services in Graphic Design");
  });

  it("checks budget compatibility", () => {
    const fits = scoreCandidate(requirement(), candidate({ minPriceInCategoryMinor: 150000 }));
    const stretch = scoreCandidate(requirement(), candidate({ minPriceInCategoryMinor: 240000 }));
    const over = scoreCandidate(requirement(), candidate({ minPriceInCategoryMinor: 900000 }));
    expect(fits.components.budget).toEqual({ earned: 15, max: 15 });
    expect(stretch.components.budget?.earned).toBeCloseTo(6);
    expect(over.components.budget?.earned).toBe(0);
    expect(fits.reasons).toContain("Starting price fits your budget");
  });

  it("omits budget when no comparable price exists instead of awarding points", () => {
    const result = scoreCandidate(requirement(), candidate({ minPriceInCategoryMinor: null, minPriceAnyMinor: null }));
    expect(result.components.budget).toBeUndefined();
  });

  it("scores busy specialists below available ones", () => {
    const available = scoreCandidate(requirement(), candidate());
    const busy = scoreCandidate(requirement(), candidate({ availability: "busy" }));
    expect(available.score).toBeGreaterThan(busy.score);
  });

  it("never awards reliability points without enough history", () => {
    const fresh = scoreCandidate(requirement(), candidate());
    expect(fresh.components.reliability).toBeUndefined();
    const thin = scoreCandidate(requirement(), candidate({ onTimeRate: 1, onTimeSample: 2 }));
    expect(thin.components.reliability).toBeUndefined();
    const proven = scoreCandidate(requirement(), candidate({ onTimeRate: 1, onTimeSample: 5, cancellationRate: 0, cancellationSample: 5 }));
    expect(proven.components.reliability).toEqual({ earned: DEFAULT_MATCH_WEIGHTS.reliability, max: DEFAULT_MATCH_WEIGHTS.reliability });
  });

  it("gives a complete new specialist a strong score (no penalty for having no reviews)", () => {
    const result = scoreCandidate(requirement(), candidate());
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.label).toBe("Strong match");
  });

  it("normalises to 0-100", () => {
    const perfect = scoreCandidate(
      requirement({ preferredExperience: "intermediate" }),
      candidate({ verificationStatus: "verified", onTimeRate: 1, onTimeSample: 10, cancellationRate: 0, cancellationSample: 10 }),
    );
    expect(perfect.score).toBe(100);
  });

  it("respects custom weights", () => {
    const weights = { ...DEFAULT_MATCH_WEIGHTS, budget: 0 };
    const result = scoreCandidate(requirement(), candidate({ minPriceInCategoryMinor: 900000 }), weights);
    expect(result.components.budget).toBeUndefined();
  });
});

describe("ranking", () => {
  it("returns a small, ordered shortlist and reports exclusions", () => {
    const candidates = [
      candidate({ specialistId: "weak", skillIds: [], portfolioInCategory: 0, portfolioTotal: 0, serviceCategoryIds: [] }),
      candidate({ specialistId: "strong", verificationStatus: "verified" }),
      candidate({ specialistId: "away", availability: "unavailable" }),
      candidate({ specialistId: "good", skillIds: ["skill-carousel"] }),
    ];
    const result = rankCandidates(requirement(), candidates, { limit: 2 });
    expect(result.matches.map((m) => m.specialistId)).toEqual(["strong", "good"]);
    expect(result.excluded).toEqual([{ specialistId: "away", reason: "unavailable" }]);
  });

  it("is deterministic for ties", () => {
    const candidates = [candidate({ specialistId: "b" }), candidate({ specialistId: "a" })];
    const first = rankCandidates(requirement(), candidates).matches.map((m) => m.specialistId);
    const second = rankCandidates(requirement(), [...candidates].reverse()).matches.map((m) => m.specialistId);
    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(first);
  });

  it("breaks ties by real completed work", () => {
    const candidates = [candidate({ specialistId: "a" }), candidate({ specialistId: "b", completedOrders: 4 })];
    expect(rankCandidates(requirement(), candidates).matches[0]?.specialistId).toBe("b");
  });
});
