/** Human-readable labels for the append-only order history. */
export const ORDER_EVENT_LABELS: Record<string, string> = {
  order_created: "Order created",
  payment_initiated: "Payment started",
  payment_verified: "Payment verified",
  payment_failed: "Payment failed",
  specialist_accepted: "Specialist accepted the order",
  work_started: "Work started",
  specialist_declined: "Specialist declined the order",
  work_submitted: "Deliverables submitted",
  revision_requested: "Revision requested",
  deliverables_approved: "Deliverables approved",
  order_completed: "Order completed",
  order_cancelled: "Order cancelled",
  dispute_opened: "Dispute opened",
  dispute_resolved: "Dispute resolved",
  refund_requested: "Refund initiated",
  refund_processed: "Refund confirmed by the payment provider",
  payout_marked: "Specialist payout recorded",
};

export function orderEventLabel(type: string): string {
  return ORDER_EVENT_LABELS[type] ?? type.replace(/_/g, " ");
}
