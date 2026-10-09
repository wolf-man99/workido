"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import type { ParticipantAction } from "@/lib/domain/orders/state-machine";
import { inspectUploadedObject } from "@/lib/storage/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/marketplace";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

const PARTICIPANT_ACTIONS: readonly ParticipantAction[] = ["accept", "decline", "submit", "request_revision", "approve", "cancel"];

async function activeUser() {
  const user = await getCurrentUser();
  return user && user.accountStatus === "active" ? user : null;
}

function revalidateOrder(orderId: string) {
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard", "layout");
}

/**
 * Every order status change goes through perform_order_action(), which
 * checks the caller's role on the order, the current status and the
 * business rules (payment, revision limits, deliverables) in the database.
 */
export async function orderTransitionAction(orderId: string, action: ParticipantAction, note?: string): Promise<ActionResult<{ status: string }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(orderId).success || !PARTICIPANT_ACTIONS.includes(action)) return fail("Invalid request.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("perform_order_action", { p_order_id: orderId, p_action: action, p_note: note?.slice(0, 4000) });
  if (error || !data) return fromDbError(error);

  const events: Partial<Record<ParticipantAction, Parameters<typeof track>[0]>> = {
    submit: "work_submitted",
    request_revision: "revision_requested",
    approve: "order_completed",
  };
  const event = events[action];
  if (event) await track(event, { order_id: orderId }, user.id);

  revalidateOrder(orderId);
  const messages: Record<ParticipantAction, string> = {
    accept: "Order accepted — work has started",
    decline: "Order declined. The buyer will be refunded.",
    submit: "Delivery submitted for review",
    request_revision: "Revision requested",
    approve: "Approved! The order is complete.",
    cancel: data.status === "refund_pending" ? "Order cancelled. A refund has been initiated." : "Order cancelled",
  };
  return ok({ status: data.status }, messages[action]);
}

export async function addDeliverableFileAction(orderId: string, input: { path: string; filename: string; description?: string }): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(orderId).success || !input.path.startsWith(`${orderId}/deliverables/`)) return fail("Invalid upload.");
  const supabase = await createSupabaseServerClient();
  const inspected = await inspectUploadedObject(supabase, "deliverable", input.path);
  if (!inspected.ok) return fail(inspected.error);
  const { error } = await supabase.from("order_deliverables").insert({
    order_id: orderId,
    uploaded_by: user.id,
    kind: "file",
    storage_path: input.path,
    filename: input.filename.slice(0, 255),
    content_type: inspected.upload.contentType,
    size_bytes: inspected.upload.size,
    description: input.description?.slice(0, 500) || null,
  });
  if (error) {
    await supabase.storage.from("order-files").remove([input.path]);
    return fromDbError(error);
  }
  revalidateOrder(orderId);
  return ok(undefined);
}

const linkSchema = z.object({
  url: z.string().trim().regex(/^https?:\/\/\S+\.\S+/i, "Enter a full URL starting with https://").max(1000),
  label: z.string().trim().min(2, "Add a short label").max(255),
});

export async function addDeliverableLinkAction(orderId: string, input: { url: string; label: string }): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(orderId).success) return fail("Invalid order.");
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("order_deliverables").insert({
    order_id: orderId,
    uploaded_by: user.id,
    kind: "link",
    external_url: parsed.data.url,
    filename: parsed.data.label,
  });
  if (error) return fromDbError(error);
  revalidateOrder(orderId);
  return ok(undefined, "Link added");
}

export async function removeDeliverableAction(deliverableId: string): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(deliverableId).success) return fail("Invalid deliverable.");
  const supabase = await createSupabaseServerClient();
  // RLS only allows deleting your own deliverables that aren't submitted yet.
  const { data, error } = await supabase.from("order_deliverables").delete().eq("id", deliverableId).select("order_id, storage_path").maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return fail("Only unsubmitted deliverables can be removed.");
  if (data.storage_path) await supabase.storage.from("order-files").remove([data.storage_path]);
  revalidateOrder(data.order_id);
  return ok(undefined, "Removed");
}

const disputeSchema = z.object({
  reason: z.enum(["quality", "missed_deadline", "scope_mismatch", "no_response", "payment", "other"], { error: "Choose a reason" }),
  description: z.string().trim().min(20, "Describe the problem in at least 20 characters").max(4000),
});

export async function openDisputeAction(orderId: string, input: z.input<typeof disputeSchema>): Promise<ActionResult<{ disputeId: string }>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(orderId).success) return fail("Invalid order.");
  const parsed = disputeSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("open_dispute", { p_order_id: orderId, p_reason: parsed.data.reason, p_description: parsed.data.description });
  if (error || !data) return fromDbError(error);
  revalidateOrder(orderId);
  return ok({ disputeId: data }, "Dispute opened. Our team will review the order history.");
}

export async function addDisputeAttachmentAction(disputeId: string, orderId: string, input: { path: string; filename: string }): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(disputeId).success || !uuid.safeParse(orderId).success || !input.path.startsWith(`${orderId}/disputes/`)) return fail("Invalid upload.");
  const supabase = await createSupabaseServerClient();
  const inspected = await inspectUploadedObject(supabase, "dispute", input.path);
  if (!inspected.ok) return fail(inspected.error);
  const { error } = await supabase.from("dispute_attachments").insert({
    dispute_id: disputeId,
    storage_path: input.path,
    filename: input.filename.slice(0, 255),
    content_type: inspected.upload.contentType,
    size_bytes: inspected.upload.size,
    uploaded_by: user.id,
  });
  if (error) {
    await supabase.storage.from("order-files").remove([input.path]);
    return fromDbError(error);
  }
  revalidateOrder(orderId);
  return ok(undefined);
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().max(2000),
});

/** Reviews are tied to a completed order; the reviewee is derived server-side. */
export async function submitReviewAction(orderId: string, input: { rating: number; comment: string }): Promise<ActionResult<undefined>> {
  const user = await activeUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(orderId).success) return fail("Invalid order.");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("buyer_id, specialist_id, status").eq("id", orderId).maybeSingle();
  if (!order) return fail("Order not found.");
  if (order.status !== "completed") return fail("You can review once the order is completed.");
  const revieweeId = order.buyer_id === user.id ? order.specialist_id : order.specialist_id === user.id ? order.buyer_id : null;
  if (!revieweeId) return fail("Order not found.");

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });
  if (error?.code === "23505") return fail("You've already reviewed this order.");
  if (error) return fromDbError(error);
  await track("review_submitted", { order_id: orderId, rating: parsed.data.rating }, user.id);
  revalidateOrder(orderId);
  return ok(undefined, "Thanks for your review!");
}

const reportSchema = z.object({
  targetType: z.enum(["message", "user", "service"]),
  targetId: uuid,
  reason: z.enum(["spam", "harassment", "fraud", "off_platform_payment", "inappropriate", "other"]),
  details: z.string().trim().max(2000),
});

export async function reportAction(input: z.input<typeof reportSchema>): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in to report content.");
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  });
  if (error) return fromDbError(error);
  return ok(undefined, "Thanks — our team will review this report.");
}
