import "server-only";
import { getServerEnv } from "@/lib/config/server-env";
import { toIsoDateInTimeZone } from "@/lib/dates";
import { minorToMajorInput } from "@/lib/domain/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RequirementInput } from "@/lib/validation/requirement";

export async function listMyRequirements(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("requirements")
    .select("id, title, status, budget_min_minor, budget_max_minor, currency, deadline_at, created_at, updated_at, submitted_at, categories!requirements_category_id_fkey(name), offers(count), requirement_invitations(count)")
    .eq("buyer_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    ...row,
    offerCount: row.offers[0]?.count ?? 0,
    invitationCount: row.requirement_invitations[0]?.count ?? 0,
  }));
}

export async function getRequirementForOwner(requirementId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: requirement, error } = await supabase
    .from("requirements")
    .select(
      "*, category:categories!requirements_category_id_fkey(name, slug), subcategory:categories!requirements_subcategory_id_fkey(name), requirement_skills(is_mandatory, skills(id, name))",
    )
    .eq("id", requirementId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!requirement) return null;

  const [attachments, matches, invitations, offers, order] = await Promise.all([
    supabase.from("requirement_attachments").select("id, filename, storage_path, size_bytes, content_type, created_at").eq("requirement_id", requirementId).order("created_at"),
    supabase
      .from("requirement_matches")
      .select("specialist_id, score, rank, reasons, computed_at")
      .eq("requirement_id", requirementId)
      .order("rank"),
    supabase.from("requirement_invitations").select("id, specialist_id, status, invited_at, responded_at").eq("requirement_id", requirementId),
    supabase
      .from("offers")
      .select("id, specialist_id, proposed_price_minor, currency, delivery_time_hours, revisions_included, message, status, created_at, updated_at")
      .eq("requirement_id", requirementId)
      .order("created_at"),
    supabase.from("orders").select("id, status, order_number").eq("requirement_id", requirementId).maybeSingle(),
  ]);

  // Public profile data for everyone involved (matched, invited or offering).
  const specialistIds = [
    ...new Set([
      ...(matches.data ?? []).map((m) => m.specialist_id),
      ...(invitations.data ?? []).map((i) => i.specialist_id),
      ...(offers.data ?? []).map((o) => o.specialist_id),
    ]),
  ];
  const [profiles, specialistProfiles] = specialistIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_path, is_sample").in("id", specialistIds),
        supabase
          .from("specialist_profiles")
          .select("user_id, headline, availability_status, verification_status, rating_avg, rating_count, completed_orders_count, experience_level")
          .in("user_id", specialistIds),
      ])
    : [{ data: [] }, { data: [] }];

  const people = new Map(
    (profiles.data ?? []).map((p) => [p.id, { ...p, specialist: (specialistProfiles.data ?? []).find((s) => s.user_id === p.id) ?? null }]),
  );

  return {
    requirement,
    attachments: attachments.data ?? [],
    matches: matches.data ?? [],
    invitations: invitations.data ?? [],
    offers: offers.data ?? [],
    order: order.data,
    people,
  };
}

export type RequirementForOwner = NonNullable<Awaited<ReturnType<typeof getRequirementForOwner>>>;

/** Converts a stored requirement back into wizard form values. */
export async function getRequirementWizardData(requirementId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: requirement, error } = await supabase
    .from("requirements")
    .select("*, requirement_skills(skill_id, is_mandatory), requirement_attachments(id, filename, size_bytes)")
    .eq("id", requirementId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!requirement) return null;

  const defaults: RequirementInput = {
    title: requirement.title,
    description: requirement.description,
    categoryId: requirement.category_id ?? "",
    subcategoryId: requirement.subcategory_id ?? "",
    skills: requirement.requirement_skills.map((skill) => ({ skillId: skill.skill_id, mandatory: skill.is_mandatory })),
    budgetMin: requirement.budget_min_minor === null ? "" : minorToMajorInput(requirement.budget_min_minor, requirement.currency),
    budgetMax: requirement.budget_max_minor === null ? "" : minorToMajorInput(requirement.budget_max_minor, requirement.currency),
    deadline: requirement.deadline_at ? toIsoDateInTimeZone(new Date(requirement.deadline_at), getServerEnv().APP_TIMEZONE) : "",
    deliverables: requirement.deliverables ?? "",
    quantity: requirement.quantity === null ? "" : String(requirement.quantity),
    revisionsExpected: requirement.revisions_expected === null ? "" : String(requirement.revisions_expected),
    referenceLinks: requirement.reference_links.length ? requirement.reference_links : [""],
    preferredExperience: requirement.preferred_experience ?? "",
    locationPreference: requirement.location_preference ?? "",
    remoteOk: requirement.remote_ok,
    urgency: requirement.urgency,
  };

  return {
    status: requirement.status,
    defaults,
    attachments: requirement.requirement_attachments.map((a) => ({ id: a.id, filename: a.filename, sizeBytes: a.size_bytes })),
  };
}

/** Requirement as seen by an invited specialist (RLS enforces the invitation). */
export async function getOpportunity(requirementId: string, specialistId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: invitation }, { data: requirement }] = await Promise.all([
    supabase.from("requirement_invitations").select("id, status, invited_at").eq("requirement_id", requirementId).eq("specialist_id", specialistId).maybeSingle(),
    supabase
      .from("requirements")
      .select("*, category:categories!requirements_category_id_fkey(name), requirement_skills(is_mandatory, skills(name)), buyer:profiles!requirements_buyer_id_fkey(full_name, username, avatar_path)")
      .eq("id", requirementId)
      .maybeSingle(),
  ]);
  if (!invitation || !requirement) return null;
  const [{ data: attachments }, { data: offer }] = await Promise.all([
    supabase.from("requirement_attachments").select("id, filename, storage_path, size_bytes").eq("requirement_id", requirementId),
    supabase
      .from("offers")
      .select("id, proposed_price_minor, currency, delivery_time_hours, revisions_included, message, status, created_at")
      .eq("requirement_id", requirementId)
      .eq("specialist_id", specialistId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { invitation, requirement, attachments: attachments ?? [], offer };
}

export async function listOpportunities(specialistId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("requirement_invitations")
    .select("id, status, invited_at, requirement:requirements(id, title, status, budget_min_minor, budget_max_minor, currency, deadline_at, urgency, category:categories!requirements_category_id_fkey(name))")
    .eq("specialist_id", specialistId)
    .order("invited_at", { ascending: false });
  if (error) throw error;
  return data;
}
