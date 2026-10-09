/**
 * Order lifecycle - the single business definition of which status changes
 * are allowed, by whom.
 *
 * The database enforces the same table (public.order_transitions, created in
 * supabase/migrations/20261009000400_orders.sql) inside SECURITY DEFINER
 * functions, so the rules hold even for direct API calls. The integration
 * test tests/integration/order-transitions.test.ts fails if the two drift.
 *
 * Simplifications versus the original brief (documented in docs/ORDERS.md):
 *  - ACCEPTED and IN_PROGRESS are one state: accepting starts the work.
 *  - APPROVED and COMPLETED are one state: approval completes the order and
 *    marks the specialist payout as pending.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "in_progress",
  "submitted",
  "revision_requested",
  "completed",
  "cancelled",
  "disputed",
  "refund_pending",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderActor = "buyer" | "specialist" | "admin" | "system";

export type OrderAction =
  | "mark_paid"
  | "cancel"
  | "accept"
  | "decline"
  | "submit"
  | "request_revision"
  | "approve"
  | "open_dispute"
  | "resolve_complete"
  | "resolve_refund"
  | "resolve_resume"
  | "late_payment"
  | "mark_refunded";

/** Actions a signed-in participant can trigger via perform_order_action(). */
export type ParticipantAction = Extract<OrderAction, "accept" | "decline" | "submit" | "request_revision" | "approve" | "cancel">;

export interface OrderTransition {
  from: OrderStatus;
  action: OrderAction;
  actor: OrderActor;
  to: OrderStatus;
}

export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  { from: "pending_payment", action: "mark_paid", actor: "system", to: "paid" },
  { from: "pending_payment", action: "cancel", actor: "buyer", to: "cancelled" },
  { from: "pending_payment", action: "cancel", actor: "specialist", to: "cancelled" },
  { from: "paid", action: "accept", actor: "specialist", to: "in_progress" },
  { from: "paid", action: "decline", actor: "specialist", to: "refund_pending" },
  { from: "paid", action: "cancel", actor: "buyer", to: "refund_pending" },
  { from: "in_progress", action: "submit", actor: "specialist", to: "submitted" },
  { from: "in_progress", action: "open_dispute", actor: "buyer", to: "disputed" },
  { from: "in_progress", action: "open_dispute", actor: "specialist", to: "disputed" },
  { from: "submitted", action: "approve", actor: "buyer", to: "completed" },
  { from: "submitted", action: "request_revision", actor: "buyer", to: "revision_requested" },
  { from: "submitted", action: "open_dispute", actor: "buyer", to: "disputed" },
  { from: "submitted", action: "open_dispute", actor: "specialist", to: "disputed" },
  { from: "revision_requested", action: "submit", actor: "specialist", to: "submitted" },
  { from: "revision_requested", action: "open_dispute", actor: "buyer", to: "disputed" },
  { from: "revision_requested", action: "open_dispute", actor: "specialist", to: "disputed" },
  { from: "disputed", action: "resolve_complete", actor: "admin", to: "completed" },
  { from: "disputed", action: "resolve_refund", actor: "admin", to: "refund_pending" },
  { from: "disputed", action: "resolve_resume", actor: "admin", to: "in_progress" },
  { from: "cancelled", action: "late_payment", actor: "system", to: "refund_pending" },
  { from: "refund_pending", action: "mark_refunded", actor: "system", to: "refunded" },
];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["completed", "cancelled", "refunded"];
export const ACTIVE_STATUSES: readonly OrderStatus[] = ["paid", "in_progress", "submitted", "revision_requested", "disputed"];

export function nextStatus(from: OrderStatus, action: OrderAction, actor: OrderActor): OrderStatus | null {
  return ORDER_TRANSITIONS.find((t) => t.from === from && t.action === action && t.actor === actor)?.to ?? null;
}

export function canTransition(from: OrderStatus, action: OrderAction, actor: OrderActor): boolean {
  return nextStatus(from, action, actor) !== null;
}

export function availableActions(status: OrderStatus, actor: OrderActor): OrderAction[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === status && t.actor === actor).map((t) => t.action);
}

export interface RevisionPolicy {
  revisionsIncluded: number;
  revisionsUsed: number;
}

/** Revisions are limited to what was agreed when the order was created. */
export function revisionsRemaining(policy: RevisionPolicy): number {
  return Math.max(0, policy.revisionsIncluded - policy.revisionsUsed);
}

export function canRequestRevision(status: OrderStatus, policy: RevisionPolicy): boolean {
  return canTransition(status, "request_revision", "buyer") && revisionsRemaining(policy) > 0;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid · awaiting acceptance",
  in_progress: "In progress",
  submitted: "Delivered · in review",
  revision_requested: "Revision requested",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "In dispute",
  refund_pending: "Refund pending",
  refunded: "Refunded",
};

export type StatusTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  pending_payment: "warning",
  paid: "brand",
  in_progress: "info",
  submitted: "brand",
  revision_requested: "warning",
  completed: "success",
  cancelled: "neutral",
  disputed: "danger",
  refund_pending: "warning",
  refunded: "neutral",
};

/** What the viewer should do next, phrased for their role. */
export function nextStepHint(status: OrderStatus, viewer: "buyer" | "specialist"): string {
  const hints: Record<OrderStatus, { buyer: string; specialist: string }> = {
    pending_payment: {
      buyer: "Complete payment so the specialist can start.",
      specialist: "Waiting for the buyer to complete payment.",
    },
    paid: {
      buyer: "Payment verified. Waiting for the specialist to accept.",
      specialist: "Payment is verified. Accept to start work, or decline so the buyer is refunded.",
    },
    in_progress: {
      buyer: "Work is underway. Use messages for questions.",
      specialist: "Upload your deliverables and submit them when ready.",
    },
    submitted: {
      buyer: "Review the delivery: approve it or request a revision.",
      specialist: "Delivered. Waiting for the buyer's review.",
    },
    revision_requested: {
      buyer: "The specialist is working on your revision.",
      specialist: "Address the revision request and submit again.",
    },
    completed: {
      buyer: "Done! Leave a review and hire again any time.",
      specialist: "Completed. Payout is recorded as pending.",
    },
    cancelled: { buyer: "This order was cancelled.", specialist: "This order was cancelled." },
    disputed: {
      buyer: "Our team is reviewing the dispute. Keep communication in messages.",
      specialist: "Our team is reviewing the dispute. Keep communication in messages.",
    },
    refund_pending: {
      buyer: "A refund has been initiated with the payment provider.",
      specialist: "This order is closed and the buyer is being refunded.",
    },
    refunded: { buyer: "Your refund was confirmed by the payment provider.", specialist: "This order was refunded." },
  };
  return hints[status][viewer];
}
