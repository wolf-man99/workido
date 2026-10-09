"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toHours, uuid } from "@/lib/validation/marketplace";
import { offerSchema, type OfferInput } from "@/lib/validation/requirement";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

async function specialist() {
  const user = await getCurrentUser();
  return user && user.isSpecialist && user.accountStatus === "active" ? user : null;
}

/** Invited specialists express interest with a single, editable offer. */
export async function submitOfferAction(requirementId: string, input: OfferInput): Promise<ActionResult<undefined>> {
  const user = await specialist();
  if (!user) return fail("Specialist tools aren't enabled for your account.");
  if (!uuid.safeParse(requirementId).success) return fail("Invalid requirement.");
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: requirement } = await supabase.from("requirements").select("currency").eq("id", requirementId).maybeSingle();
  if (!requirement) return fail("This requirement isn't available.");

  const { error } = await supabase.from("offers").insert({
    requirement_id: requirementId,
    specialist_id: user.id,
    proposed_price_minor: parsed.data.price,
    currency: requirement.currency,
    delivery_time_hours: toHours(parsed.data.deliveryValue, parsed.data.deliveryUnit),
    revisions_included: parsed.data.revisionsIncluded,
    message: parsed.data.message,
  });
  if (error?.code === "23505") return fail("You already have an active offer on this task. Edit it instead.");
  if (error) return fromDbError(error);
  await track("offer_submitted", { requirement_id: requirementId }, user.id);
  revalidatePath("/dashboard/specialist/opportunities", "layout");
  return ok(undefined, "Offer sent to the buyer");
}

export async function updateOfferAction(offerId: string, input: OfferInput): Promise<ActionResult<undefined>> {
  const user = await specialist();
  if (!user) return fail("Specialist tools aren't enabled for your account.");
  if (!uuid.safeParse(offerId).success) return fail("Invalid offer.");
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("offers")
    .update({
      proposed_price_minor: parsed.data.price,
      delivery_time_hours: toHours(parsed.data.deliveryValue, parsed.data.deliveryUnit),
      revisions_included: parsed.data.revisionsIncluded,
      message: parsed.data.message,
    })
    .eq("id", offerId)
    .eq("specialist_id", user.id)
    .eq("status", "pending")
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return fail("Only pending offers can be edited.");
  revalidatePath("/dashboard/specialist/opportunities", "layout");
  return ok(undefined, "Offer updated");
}

export async function withdrawOfferAction(offerId: string): Promise<ActionResult<undefined>> {
  const user = await specialist();
  if (!user) return fail("Specialist tools aren't enabled for your account.");
  if (!uuid.safeParse(offerId).success) return fail("Invalid offer.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("offers")
    .update({ status: "withdrawn" })
    .eq("id", offerId)
    .eq("specialist_id", user.id)
    .eq("status", "pending")
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return fail("Only pending offers can be withdrawn.");
  revalidatePath("/dashboard/specialist/opportunities", "layout");
  return ok(undefined, "Offer withdrawn");
}

export async function declineInvitationAction(invitationId: string): Promise<ActionResult<undefined>> {
  const user = await specialist();
  if (!user) return fail("Specialist tools aren't enabled for your account.");
  if (!uuid.safeParse(invitationId).success) return fail("Invalid invitation.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("requirement_invitations")
    .update({ status: "declined" })
    .eq("id", invitationId)
    .eq("specialist_id", user.id)
    .eq("status", "invited")
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return fail("This invitation can't be declined.");
  revalidatePath("/dashboard/specialist/opportunities", "layout");
  return ok(undefined, "Invitation declined");
}
