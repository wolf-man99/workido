"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { PROPOSAL_COLUMNS, type ProposalView } from "@/lib/chat/messages";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid, toHours } from "@/lib/validation/marketplace";
import { counterOfferSchema, proposalSchema, type CounterOfferInput, type ProposalInput } from "@/lib/validation/proposal";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

/**
 * Proposals in the pre-order chat. Every rule (who may act, one counter-offer,
 * expiry, order creation) is enforced by the database functions; these
 * actions validate input and translate errors.
 */
type Session = { ok: true; user: CurrentUser } | { ok: false; error: string };

async function activeUser(): Promise<Session> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in again." };
  if (user.accountStatus !== "active") return { ok: false, error: "Your account is suspended." };
  return { ok: true, user };
}

export async function sendProposalAction(conversationId: string, input: ProposalInput, serviceId?: string | null): Promise<ActionResult<{ proposalId: string }>> {
  const session = await activeUser();
  if (!session.ok) return fail(session.error);
  if (!uuid.safeParse(conversationId).success || (serviceId && !uuid.safeParse(serviceId).success)) return fail("Invalid conversation.");
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("send_proposal", {
    p_conversation_id: conversationId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_deliverables: parsed.data.deliverables,
    p_price_minor: parsed.data.price,
    p_delivery_time_hours: toHours(parsed.data.deliveryValue, parsed.data.deliveryUnit),
    p_revisions_included: parsed.data.revisions,
    p_service_id: serviceId ?? undefined,
  });
  if (error || !data) return fromDbError(error, "Your proposal couldn't be sent.");
  await track("proposal_sent", { conversation_id: conversationId }, session.user.id);
  return ok({ proposalId: data }, "Proposal sent");
}

export async function acceptProposalAction(proposalId: string): Promise<ActionResult<{ orderId: string }>> {
  const session = await activeUser();
  if (!session.ok) return fail(session.error);
  if (!uuid.safeParse(proposalId).success) return fail("Invalid proposal.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_proposal", { p_proposal_id: proposalId });
  if (error || !data) return fromDbError(error, "We couldn't accept this proposal. Please try again.");
  await track("order_created", { source: "proposal", order_id: data }, session.user.id);
  revalidatePath("/dashboard/buyer", "layout");
  return ok({ orderId: data });
}

export async function counterProposalAction(proposalId: string, input: CounterOfferInput): Promise<ActionResult<undefined>> {
  const session = await activeUser();
  if (!session.ok) return fail(session.error);
  if (!uuid.safeParse(proposalId).success) return fail("Invalid proposal.");
  const parsed = counterOfferSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("counter_proposal", {
    p_proposal_id: proposalId,
    p_price_minor: parsed.data.price,
    p_delivery_time_hours: toHours(parsed.data.deliveryValue, parsed.data.deliveryUnit),
    p_note: parsed.data.note || undefined,
  });
  if (error) return fromDbError(error, "Your counter-offer couldn't be sent.");
  await track("proposal_countered", {}, session.user.id);
  return ok(undefined, "Counter-offer sent");
}

export async function respondToCounterAction(proposalId: string, accept: boolean): Promise<ActionResult<{ orderId: string | null }>> {
  const session = await activeUser();
  if (!session.ok) return fail(session.error);
  if (!uuid.safeParse(proposalId).success) return fail("Invalid proposal.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("respond_to_counter", { p_proposal_id: proposalId, p_accept: accept });
  if (error) return fromDbError(error, "We couldn't record your answer. Please try again.");
  if (accept && data) await track("order_created", { source: "proposal", order_id: data }, session.user.id);
  return ok({ orderId: data ?? null }, accept ? "Counter-offer accepted" : "Counter-offer declined");
}

export async function declineProposalAction(proposalId: string): Promise<ActionResult<undefined>> {
  const session = await activeUser();
  if (!session.ok) return fail(session.error);
  if (!uuid.safeParse(proposalId).success) return fail("Invalid proposal.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("decline_proposal", { p_proposal_id: proposalId });
  if (error) return fromDbError(error);
  return ok(undefined, "Proposal declined");
}

export async function withdrawProposalAction(proposalId: string): Promise<ActionResult<undefined>> {
  const session = await activeUser();
  if (!session.ok) return fail(session.error);
  if (!uuid.safeParse(proposalId).success) return fail("Invalid proposal.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("withdraw_proposal", { p_proposal_id: proposalId });
  if (error) return fromDbError(error);
  return ok(undefined, "Proposal withdrawn");
}

/** Fresh copy of a proposal after an event arrives in the chat (RLS: participants only). */
export async function fetchProposalAction(proposalId: string): Promise<ActionResult<ProposalView>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(proposalId).success) return fail("Invalid proposal.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("chat_proposals").select(PROPOSAL_COLUMNS).eq("id", proposalId).maybeSingle();
  if (error || !data) return fail("Proposal not found.");
  return ok(data as ProposalView);
}
