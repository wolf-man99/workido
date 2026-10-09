"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/server-env";
import { endOfDayInTimeZone, toIsoDateInTimeZone } from "@/lib/dates";
import { refreshMatches } from "@/lib/matching/service";
import { inspectUploadedObject } from "@/lib/storage/server";
import { createSupabaseServerClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { uuid } from "@/lib/validation/marketplace";
import { requirementDraftSchema, requirementSchema, type RequirementInput } from "@/lib/validation/requirement";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

type RequirementUpdate = Database["public"]["Tables"]["requirements"]["Update"];

async function activeUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && user.accountStatus === "active" ? user : null;
}

function deadlineFromDate(date: string): string | null {
  if (!date) return null;
  return endOfDayInTimeZone(date, getServerEnv().APP_TIMEZONE).toISOString();
}

function rowFrom(values: {
  title: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  budgetMin: number | null;
  budgetMax: number | null;
  deadline: string;
  deliverables: string;
  quantity: number | null;
  revisionsExpected: number | null;
  referenceLinks: string[];
  preferredExperience: "" | "entry" | "intermediate" | "expert";
  locationPreference: string;
  remoteOk: boolean;
  urgency: "flexible" | "standard" | "urgent";
}): RequirementUpdate {
  return {
    title: values.title,
    description: values.description,
    category_id: values.categoryId || null,
    subcategory_id: values.subcategoryId || null,
    budget_min_minor: values.budgetMin,
    budget_max_minor: values.budgetMax,
    deadline_at: deadlineFromDate(values.deadline),
    deliverables: values.deliverables || null,
    quantity: values.quantity,
    revisions_expected: values.revisionsExpected,
    reference_links: values.referenceLinks,
    preferred_experience: values.preferredExperience || null,
    location_preference: values.locationPreference || null,
    remote_ok: values.remoteOk,
    urgency: values.urgency,
  };
}

async function replaceSkills(supabase: ServerSupabaseClient, requirementId: string, skills: { skillId: string; mandatory: boolean }[]) {
  const { error: deleteError } = await supabase.from("requirement_skills").delete().eq("requirement_id", requirementId);
  if (deleteError) return deleteError;
  if (skills.length === 0) return null;
  const unique = new Map(skills.map((skill) => [skill.skillId, skill.mandatory]));
  const { error } = await supabase
    .from("requirement_skills")
    .insert([...unique.entries()].map(([skill_id, is_mandatory]) => ({ requirement_id: requirementId, skill_id, is_mandatory })));
  return error;
}

/** Creates or updates a draft. Returns the requirement id so uploads can attach to it. */
export async function saveRequirementDraftAction(requirementId: string | null, input: RequirementInput): Promise<ActionResult<{ id: string }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  const parsed = requirementDraftSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const row = rowFrom(parsed.data);

  let id = requirementId;
  if (id) {
    if (!uuid.safeParse(id).success) return fail("Invalid requirement.");
    const { data: existing } = await supabase.from("requirements").select("status").eq("id", id).eq("buyer_id", user.id).maybeSingle();
    if (!existing) return fail("Requirement not found.");
    // Open requirements are edited in place (no going back to draft).
    const { error } = await supabase.from("requirements").update(row).eq("id", id).eq("buyer_id", user.id);
    if (error) return fromDbError(error);
  } else {
    const { data, error } = await supabase
      .from("requirements")
      .insert({ ...row, title: parsed.data.title, buyer_id: user.id, status: "draft" })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    id = data.id;
  }
  const skillError = await replaceSkills(supabase, id, parsed.data.skills);
  if (skillError) return fromDbError(skillError);
  revalidatePath("/dashboard/buyer/requirements");
  return ok({ id }, "Draft saved");
}

/**
 * Publishes (or re-saves an open) requirement, runs matching and optionally
 * invites a specialist the buyer arrived with (e.g. "Hire again").
 */
export async function submitRequirementAction(
  requirementId: string | null,
  input: RequirementInput,
  inviteUsername?: string,
): Promise<ActionResult<{ id: string; matches: number }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  const parsed = requirementSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (parsed.data.deadline) {
    const today = toIsoDateInTimeZone(new Date(), getServerEnv().APP_TIMEZONE);
    if (parsed.data.deadline < today) return fail("The deadline can't be in the past.", { deadline: "Choose today or a later date" });
  }

  const supabase = await createSupabaseServerClient();
  const row = { ...rowFrom(parsed.data), status: "open" as const };

  let id = requirementId;
  let wasOpen = false;
  if (id) {
    if (!uuid.safeParse(id).success) return fail("Invalid requirement.");
    const { data: existing } = await supabase.from("requirements").select("status").eq("id", id).eq("buyer_id", user.id).maybeSingle();
    if (!existing) return fail("Requirement not found.");
    if (existing.status !== "draft" && existing.status !== "open") return fail("This requirement can no longer be edited.");
    wasOpen = existing.status === "open";
    const { error } = await supabase.from("requirements").update(row).eq("id", id).eq("buyer_id", user.id);
    if (error) return fromDbError(error);
  } else {
    const { data, error } = await supabase
      .from("requirements")
      .insert({ ...row, title: parsed.data.title, buyer_id: user.id })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    id = data.id;
  }

  const skillError = await replaceSkills(supabase, id, parsed.data.skills);
  if (skillError) return fromDbError(skillError);

  // Posting a task makes the user a buyer.
  if (!user.isBuyer) {
    await supabase.from("user_roles").upsert({ user_id: user.id, role: "buyer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  }

  let matchCount = 0;
  try {
    matchCount = (await refreshMatches(supabase, id)).length;
  } catch (error) {
    console.error("[matching] failed", error instanceof Error ? error.message : error);
  }

  if (inviteUsername) {
    const { data: target } = await supabase.from("profiles").select("id").eq("username", inviteUsername.toLowerCase()).maybeSingle();
    if (target && target.id !== user.id) {
      const { error: inviteError } = await supabase
        .from("requirement_invitations")
        .upsert({ requirement_id: id, specialist_id: target.id }, { onConflict: "requirement_id,specialist_id", ignoreDuplicates: true });
      if (inviteError) console.warn("[requirements] invite failed", inviteError.message);
      else await track("repeat_hire_started", { requirement_id: id }, user.id);
    }
  }

  if (!wasOpen) await track("requirement_created", { requirement_id: id, matches: matchCount }, user.id);
  revalidatePath("/dashboard/buyer", "layout");
  return ok({ id, matches: matchCount }, wasOpen ? "Requirement updated" : "Requirement posted");
}

export async function closeRequirementAction(requirementId: string): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(requirementId).success) return fail("Invalid requirement.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("requirements")
    .update({ status: "closed" })
    .eq("id", requirementId)
    .eq("buyer_id", user.id)
    .eq("status", "open")
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return fail("Only open requirements can be closed.");
  revalidatePath("/dashboard/buyer", "layout");
  return ok(undefined, "Requirement closed");
}

export async function deleteDraftRequirementAction(requirementId: string): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(requirementId).success) return fail("Invalid requirement.");
  const supabase = await createSupabaseServerClient();
  const { data: attachments } = await supabase.from("requirement_attachments").select("storage_path").eq("requirement_id", requirementId);
  const { data, error } = await supabase.from("requirements").delete().eq("id", requirementId).eq("buyer_id", user.id).eq("status", "draft").select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return fail("Only drafts can be deleted.");
  if (attachments?.length) await supabase.storage.from("requirement-files").remove(attachments.map((a) => a.storage_path));
  revalidatePath("/dashboard/buyer", "layout");
  return ok(undefined, "Draft deleted");
}

export async function addRequirementAttachmentAction(requirementId: string, input: { path: string; filename: string }): Promise<ActionResult<{ id: string }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(requirementId).success || !input.path.startsWith(`${requirementId}/`)) return fail("Invalid upload.");
  const supabase = await createSupabaseServerClient();
  const inspected = await inspectUploadedObject(supabase, "requirement", input.path);
  if (!inspected.ok) return fail(inspected.error);
  const { data, error } = await supabase
    .from("requirement_attachments")
    .insert({
      requirement_id: requirementId,
      storage_path: input.path,
      filename: input.filename.slice(0, 255),
      content_type: inspected.upload.contentType,
      size_bytes: inspected.upload.size,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("requirement-files").remove([input.path]);
    return fromDbError(error);
  }
  revalidatePath(`/dashboard/buyer/requirements/${requirementId}`);
  return ok({ id: data.id });
}

export async function removeRequirementAttachmentAction(attachmentId: string): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(attachmentId).success) return fail("Invalid attachment.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("requirement_attachments").delete().eq("id", attachmentId).select("storage_path, requirement_id").maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return fail("Attachment not found.");
  await supabase.storage.from("requirement-files").remove([data.storage_path]);
  revalidatePath(`/dashboard/buyer/requirements/${data.requirement_id}`);
  return ok(undefined, "Attachment removed");
}

export async function refreshMatchesAction(requirementId: string): Promise<ActionResult<{ matches: number }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(requirementId).success) return fail("Invalid requirement.");
  const supabase = await createSupabaseServerClient();
  try {
    const matches = await refreshMatches(supabase, requirementId);
    revalidatePath(`/dashboard/buyer/requirements/${requirementId}`);
    return ok({ matches: matches.length }, matches.length ? `Found ${matches.length} suitable specialist${matches.length === 1 ? "" : "s"}` : "No suitable specialists right now");
  } catch {
    return fail("We couldn't refresh matches. Please try again.");
  }
}

export async function inviteSpecialistsAction(requirementId: string, specialistIds: string[]): Promise<ActionResult<{ invited: number }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(requirementId).success || specialistIds.some((id) => !uuid.safeParse(id).success)) return fail("Invalid request.");
  if (specialistIds.length === 0) return fail("Choose at least one specialist.");
  const supabase = await createSupabaseServerClient();
  let invited = 0;
  for (const specialistId of specialistIds.slice(0, 10)) {
    const { error } = await supabase
      .from("requirement_invitations")
      .upsert({ requirement_id: requirementId, specialist_id: specialistId }, { onConflict: "requirement_id,specialist_id", ignoreDuplicates: true });
    if (error) return fromDbError(error);
    invited++;
  }
  revalidatePath(`/dashboard/buyer/requirements/${requirementId}`);
  return ok({ invited }, invited === 1 ? "Invitation sent" : `${invited} invitations sent`);
}

export async function acceptOfferAction(offerId: string): Promise<ActionResult<{ orderId: string }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(offerId).success) return fail("Invalid offer.");
  const supabase = await createSupabaseServerClient();
  const { data: orderId, error } = await supabase.rpc("accept_offer", { p_offer_id: offerId });
  if (error || !orderId) return fromDbError(error);
  await track("offer_accepted", { offer_id: offerId }, user.id);
  await track("order_created", { source: "offer", order_id: orderId }, user.id);
  revalidatePath("/dashboard/buyer", "layout");
  return ok({ orderId }, "Offer accepted — complete payment to start the work");
}

export async function declineOfferAction(offerId: string): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(offerId).success) return fail("Invalid offer.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("decline_offer", { p_offer_id: offerId });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/buyer", "layout");
  return ok(undefined, "Offer declined");
}
