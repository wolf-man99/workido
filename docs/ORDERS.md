# Order lifecycle

Defined in `src/lib/domain/orders/state-machine.ts` and enforced by `public.order_transitions` + `apply_order_transition()` in the database. `tests/integration/order-transitions.test.ts` fails if the two definitions differ.

## States

| Status | Meaning |
| --- | --- |
| `pending_payment` | Order created from a gig or an accepted offer; waiting for verified payment |
| `paid` | Payment verified; waiting for the specialist to accept |
| `in_progress` | Specialist accepted; work underway (delivery deadline starts now) |
| `submitted` | Deliverables submitted for the buyer's review |
| `revision_requested` | Buyer asked for changes (within the included revisions) |
| `completed` | Buyer approved (or admin resolved a dispute as complete); payout pending |
| `cancelled` | Cancelled before payment |
| `disputed` | A participant opened a dispute; admin decides |
| `refund_pending` | Money must go back to the buyer; refund record created |
| `refunded` | Provider confirmed the refund |

### Simplifications vs. the original brief

- **ACCEPTED + IN_PROGRESS merged.** Accepting starts the work; both events (`specialist_accepted`, `work_started`) are still recorded.
- **APPROVED + COMPLETED merged.** Approval completes the order and sets `payout_status = pending`. Settlement is tracked separately (`payout_status`) because no provider-supported settlement flow is configured yet.

## Transitions

| From | Action | Actor | To |
| --- | --- | --- | --- |
| pending_payment | mark_paid | system (verified payment) | paid |
| pending_payment | cancel | buyer / specialist | cancelled |
| paid | accept | specialist | in_progress |
| paid | decline | specialist | refund_pending |
| paid | cancel | buyer | refund_pending |
| in_progress | submit | specialist | submitted |
| submitted | approve | buyer | completed |
| submitted | request_revision | buyer | revision_requested |
| revision_requested | submit | specialist | submitted |
| in_progress / submitted / revision_requested | open_dispute | buyer / specialist | disputed |
| disputed | resolve_complete / resolve_refund / resolve_resume | admin | completed / refund_pending / in_progress |
| cancelled | late_payment | system | refund_pending |
| refund_pending | mark_refunded | system (provider-confirmed refund) | refunded |

Everything else is rejected with a clear message.

## Business rules checked in the database

- Caller must be the buyer or specialist of the order (or admin for resolutions) and have an active account.
- Paid work cannot start before verified payment (`accept` only from `paid`).
- `submit` requires a delivery message and at least one unsubmitted file or link; it creates a versioned `order_submissions` row and attaches those deliverables.
- `request_revision` requires a note (≥10 chars) and `revisions_used < revisions_included`.
- Cancelling after payment always creates a refund record; work in progress can only be stopped through a dispute.
- Scope, price, delivery time and revision policy are snapshotted at order creation; later listing edits don't affect existing orders.

## History

`order_events` is append-only (no user write grants). Recorded events: order_created, payment_initiated, payment_verified, payment_failed, specialist_accepted, work_started, specialist_declined, work_submitted, revision_requested, deliverables_approved, order_completed, order_cancelled, dispute_opened, dispute_resolved, refund_requested, refund_processed, payout_marked. Notes (revision requests, cancellation reasons, resolutions) are stored in event metadata and shown on the order timeline.

## Not yet automated

- Auto-approval after a review period, and automatic cancellation of long-unpaid orders, are not implemented (see KNOWN_LIMITATIONS.md).
