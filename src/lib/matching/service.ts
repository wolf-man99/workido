import "server-only";
import { listCategories } from "@/lib/data/marketplace";
import { rankCandidates, type MatchCandidate, type MatchRequirement, type ScoredMatch } from "@/lib/domain/matching/engine";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/** Shortlist size shown to buyers: quality over quantity. */
export const SHORTLIST_SIZE = 8;

/**
 * Runs the deterministic matching engine for a requirement and stores the
 * shortlist in requirement_matches (visible to the requirement owner only).
 * Runs with the buyer's session: get_match_candidates() checks ownership.
 */
export async function refreshMatches(supabase: ServerSupabaseClient, requirementId: string): Promise<ScoredMatch[]> {
  const { data: requirement, error } = await supabase
    .from("requirements")
    .select("id, category_id, subcategory_id, budget_max_minor, deadline_at, urgency, preferred_experience, status, requirement_skills(skill_id, is_mandatory)")
    .eq("id", requirementId)
    .single();
  if (error) throw error;
  if (!requirement.category_id) return [];

  const categories = await listCategories();
  const category = categories.find((c) => c.id === requirement.category_id);
  const relevantCategoryIds = categories
    .filter((c) => c.id === requirement.category_id || c.id === requirement.subcategory_id || c.parent_id === requirement.category_id)
    .map((c) => c.id);

  const { data: rows, error: candidateError } = await supabase.rpc("get_match_candidates", { p_requirement_id: requirementId });
  if (candidateError) throw candidateError;

  const matchRequirement: MatchRequirement = {
    categoryIds: relevantCategoryIds,
    categoryName: category?.name ?? "this category",
    skills: requirement.requirement_skills.map((skill) => ({ skillId: skill.skill_id, mandatory: skill.is_mandatory })),
    budgetMaxMinor: requirement.budget_max_minor,
    deadlineAt: requirement.deadline_at ? new Date(requirement.deadline_at) : null,
    urgency: requirement.urgency,
    preferredExperience: requirement.preferred_experience,
    now: new Date(),
  };

  const candidates: MatchCandidate[] = (rows ?? []).map((row) => ({
    specialistId: row.specialist_id,
    isPublished: row.is_published,
    accountStatus: row.account_status,
    availability: row.availability_status,
    verificationStatus: row.verification_status,
    experienceLevel: row.experience_level,
    skillIds: row.skill_ids ?? [],
    categoryIds: row.category_ids ?? [],
    serviceCategoryIds: row.service_category_ids ?? [],
    minPriceInCategoryMinor: row.min_price_in_category_minor,
    minPriceAnyMinor: row.min_price_any_minor,
    minDeliveryInCategoryHours: row.min_delivery_in_category_hours,
    minDeliveryAnyHours: row.min_delivery_any_hours,
    portfolioInCategory: row.portfolio_in_category ?? 0,
    portfolioTotal: row.portfolio_total ?? 0,
    completedOrders: row.completed_orders ?? 0,
    onTimeRate: row.on_time_rate === null ? null : Number(row.on_time_rate),
    onTimeSample: row.on_time_sample ?? 0,
    cancellationRate: row.cancellation_rate === null ? null : Number(row.cancellation_rate),
    cancellationSample: row.cancellation_sample ?? 0,
  }));

  const { matches } = rankCandidates(matchRequirement, candidates, { limit: SHORTLIST_SIZE });

  // Replace the stored shortlist atomically enough for a single owner.
  const { error: deleteError } = await supabase.from("requirement_matches").delete().eq("requirement_id", requirementId);
  if (deleteError) throw deleteError;
  if (matches.length > 0) {
    const { error: insertError } = await supabase.from("requirement_matches").insert(
      matches.map((match, index) => ({
        requirement_id: requirementId,
        specialist_id: match.specialistId,
        score: match.score,
        rank: index + 1,
        reasons: match.reasons,
      })),
    );
    if (insertError) throw insertError;
  }
  const { error: stampError } = await supabase
    .from("requirements")
    .update({ matches_computed_at: new Date().toISOString() })
    .eq("id", requirementId);
  if (stampError) throw stampError;
  return matches;
}
