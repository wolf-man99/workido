"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { inspectUploadedObject } from "@/lib/storage/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  availabilitySchema,
  portfolioLinkSchema,
  portfolioUploadSchema,
  serviceSchema,
  specialistProfileSchema,
  toHours,
  uuid,
  type PortfolioLinkInput,
  type ServiceInput,
  type SpecialistProfileInput,
} from "@/lib/validation/marketplace";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

async function requireSpecialistUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || !user.isSpecialist || user.accountStatus !== "active") return null;
  return user;
}

const NOT_SPECIALIST = "Specialist tools aren't enabled for your account.";

function revalidateSpecialist(username?: string) {
  revalidatePath("/dashboard/specialist", "layout");
  if (username) revalidatePath(`/specialists/${username}`);
  revalidatePath("/specialists");
  revalidatePath("/gigs");
}

export async function updateSpecialistProfileAction(input: SpecialistProfileInput): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  const parsed = specialistProfileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("specialist_profiles")
    .update({
      headline: data.headline,
      professional_bio: data.professionalBio,
      experience_level: data.experienceLevel,
      years_experience: data.yearsExperience,
    })
    .eq("user_id", user.id);
  if (error) return fromDbError(error);

  // Replace skills and categories with the submitted sets.
  const [{ data: currentSkills }, { data: currentCategories }] = await Promise.all([
    supabase.from("specialist_skills").select("skill_id").eq("specialist_id", user.id),
    supabase.from("specialist_categories").select("category_id").eq("specialist_id", user.id),
  ]);
  const wantedSkills = new Set(data.skillIds);
  const haveSkills = new Set((currentSkills ?? []).map((row) => row.skill_id));
  const wantedCategories = new Set(data.categoryIds);
  const haveCategories = new Set((currentCategories ?? []).map((row) => row.category_id));

  const addSkills = [...wantedSkills].filter((id) => !haveSkills.has(id));
  const removeSkills = [...haveSkills].filter((id) => !wantedSkills.has(id));
  const addCategories = [...wantedCategories].filter((id) => !haveCategories.has(id));
  const removeCategories = [...haveCategories].filter((id) => !wantedCategories.has(id));

  // Insert before deleting so a published profile never has zero skills.
  if (addSkills.length) {
    const { error: e } = await supabase.from("specialist_skills").insert(addSkills.map((skill_id) => ({ specialist_id: user.id, skill_id })));
    if (e) return fromDbError(e);
  }
  if (removeSkills.length) {
    const { error: e } = await supabase.from("specialist_skills").delete().eq("specialist_id", user.id).in("skill_id", removeSkills);
    if (e) return fromDbError(e);
  }
  if (addCategories.length) {
    const { error: e } = await supabase
      .from("specialist_categories")
      .insert(addCategories.map((category_id) => ({ specialist_id: user.id, category_id })));
    if (e) return fromDbError(e);
  }
  if (removeCategories.length) {
    const { error: e } = await supabase.from("specialist_categories").delete().eq("specialist_id", user.id).in("category_id", removeCategories);
    if (e) return fromDbError(e);
  }

  await track("profile_completed", { role: "specialist" }, user.id);
  revalidateSpecialist(user.username);
  return ok(undefined, "Profile saved");
}

export async function setProfilePublishedAction(publish: boolean): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  const supabase = await createSupabaseServerClient();
  // The database refuses to publish an incomplete profile and explains why.
  const { error } = await supabase.from("specialist_profiles").update({ is_published: publish }).eq("user_id", user.id);
  if (error) return fromDbError(error);
  if (publish) await track("specialist_profile_published", {}, user.id);
  revalidateSpecialist(user.username);
  return ok(undefined, publish ? "Your profile is live" : "Your profile is hidden");
}

export async function setAvailabilityAction(input: { availability: string }): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("specialist_profiles").update({ availability_status: parsed.data.availability }).eq("user_id", user.id);
  if (error) return fromDbError(error);
  revalidateSpecialist(user.username);
  return ok(undefined, "Availability updated");
}

export async function requestVerificationAction(input: { note: string }): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_verification_request", { p_note: input.note.trim().slice(0, 1000) || undefined });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/specialist", "layout");
  return ok(undefined, "Verification requested. Our team will review your profile.");
}

/* -------------------------------- Portfolio -------------------------------- */

export async function addPortfolioLinkAction(input: PortfolioLinkInput): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  const parsed = portfolioLinkSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("portfolio_items").insert({
    specialist_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    category_id: parsed.data.categoryId || null,
    external_url: parsed.data.externalUrl,
  });
  if (error) return fromDbError(error);
  revalidateSpecialist(user.username);
  return ok(undefined, "Portfolio item added");
}

export async function addPortfolioUploadAction(input: { title: string; description?: string; categoryId?: string; path: string }): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  const parsed = portfolioUploadSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (!parsed.data.path.startsWith(`${user.id}/`)) return fail("Invalid upload.");

  const supabase = await createSupabaseServerClient();
  const inspected = await inspectUploadedObject(supabase, "portfolio", parsed.data.path);
  if (!inspected.ok) return fail(inspected.error);

  const { error } = await supabase.from("portfolio_items").insert({
    specialist_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    category_id: parsed.data.categoryId || null,
    asset_path: parsed.data.path,
  });
  if (error) {
    await supabase.storage.from("portfolio").remove([parsed.data.path]);
    return fromDbError(error);
  }
  revalidateSpecialist(user.username);
  return ok(undefined, "Portfolio item added");
}

export async function deletePortfolioItemAction(itemId: string): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  if (!uuid.safeParse(itemId).success) return fail("Invalid item.");
  const supabase = await createSupabaseServerClient();
  const { data: item, error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", itemId)
    .eq("specialist_id", user.id)
    .select("asset_path")
    .maybeSingle();
  if (error) return fromDbError(error);
  if (!item) return fail("Portfolio item not found.");
  if (item.asset_path) await supabase.storage.from("portfolio").remove([item.asset_path]);
  revalidateSpecialist(user.username);
  return ok(undefined, "Removed");
}

export async function setPortfolioVisibilityAction(itemId: string, visible: boolean): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  if (!uuid.safeParse(itemId).success) return fail("Invalid item.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("portfolio_items")
    .update({ visibility: visible ? "public" : "hidden" })
    .eq("id", itemId)
    .eq("specialist_id", user.id);
  if (error) return fromDbError(error);
  revalidateSpecialist(user.username);
  return ok(undefined, visible ? "Visible on your profile" : "Hidden from your profile");
}

/* --------------------------------- Services --------------------------------- */

function serviceRow(data: ReturnType<typeof serviceSchema.parse>) {
  return {
    title: data.title,
    category_id: data.categoryId,
    description: data.description,
    deliverables: data.deliverables,
    buyer_instructions: data.buyerInstructions,
    price_minor: data.price,
    delivery_time_hours: toHours(data.deliveryValue, data.deliveryUnit),
    included_revisions: data.includedRevisions,
  };
}

export async function createServiceAction(input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .insert({ ...serviceRow(parsed.data), specialist_id: user.id, publication_status: parsed.data.publish ? "published" : "draft" })
    .select("id")
    .single();
  if (error) return fromDbError(error);
  if (parsed.data.publish) await track("service_published", { service_id: data.id }, user.id);
  revalidateSpecialist(user.username);
  return ok({ id: data.id }, parsed.data.publish ? "Service published" : "Draft saved");
}

export async function updateServiceAction(serviceId: string, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  if (!uuid.safeParse(serviceId).success) return fail("Invalid service.");
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("services").select("publication_status").eq("id", serviceId).eq("specialist_id", user.id).maybeSingle();
  if (!existing) return fail("Service not found.");
  if (existing.publication_status === "removed") return fail("This listing was removed by moderation and can't be edited.");

  const nextStatus = parsed.data.publish ? "published" : existing.publication_status === "published" ? "unpublished" : existing.publication_status;
  const { error } = await supabase
    .from("services")
    .update({ ...serviceRow(parsed.data), publication_status: nextStatus })
    .eq("id", serviceId)
    .eq("specialist_id", user.id);
  if (error) return fromDbError(error);
  if (parsed.data.publish && existing.publication_status !== "published") await track("service_published", { service_id: serviceId }, user.id);
  revalidateSpecialist(user.username);
  return ok({ id: serviceId }, "Service saved");
}

export async function setServicePublishedAction(serviceId: string, publish: boolean): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  if (!uuid.safeParse(serviceId).success) return fail("Invalid service.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .update({ publication_status: publish ? "published" : "unpublished" })
    .eq("id", serviceId)
    .eq("specialist_id", user.id)
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return fail("Service not found.");
  if (publish) await track("service_published", { service_id: serviceId }, user.id);
  revalidateSpecialist(user.username);
  return ok(undefined, publish ? "Service published" : "Service unpublished");
}

export async function deleteServiceAction(serviceId: string): Promise<ActionResult<undefined>> {
  const user = await requireSpecialistUser();
  if (!user) return fail(NOT_SPECIALIST);
  if (!uuid.safeParse(serviceId).success) return fail("Invalid service.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("services").delete().eq("id", serviceId).eq("specialist_id", user.id).select("id");
  if (error?.code === "23503") {
    return fail("This service has orders, so it can't be deleted. Unpublish it instead to stop new orders.");
  }
  if (error) return fromDbError(error);
  if (!data?.length) return fail("Service not found.");
  revalidateSpecialist(user.username);
  return ok(undefined, "Service deleted");
}
