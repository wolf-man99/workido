import { CalendarClock, CreditCard, ExternalLink, History, Link2, MessageSquare, Paperclip, Repeat, Scale } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { StarRow } from "@/components/ui/misc";
import type { OrderDetail } from "@/lib/data/orders";
import { formatMoney } from "@/lib/domain/money";
import { orderEventLabel } from "@/lib/domain/orders/events";
import { availableActions, nextStepHint, revisionsRemaining, type OrderStatus } from "@/lib/domain/orders/state-machine";
import { formatDateTime, formatDeliveryTime, formatFileSize } from "@/lib/format";
import { privateFileHref } from "@/lib/storage/server";
import { DeliverableManager, DisputeButton, ReviewForm, TransitionButton } from "./order-actions";
import { OrderStatusBadge } from "./order-list";

type Viewer = "buyer" | "specialist" | "admin";

interface Scope {
  description?: string | null;
  deliverables?: string | null;
  buyer_instructions?: string | null;
  offer_message?: string | null;
  quantity?: number | null;
  reference_links?: string[] | null;
  service_slug?: string | null;
  category?: string | null;
}

const DISPUTE_REASON_LABELS: Record<string, string> = {
  quality: "Quality doesn't match the scope",
  missed_deadline: "Missed deadline",
  scope_mismatch: "Scope disagreement",
  no_response: "No response",
  payment: "Payment problem",
  other: "Other",
};

export function OrderDetailView({ detail, viewer, viewerId }: { detail: OrderDetail; viewer: Viewer; viewerId: string }) {
  const { order, events, submissions, deliverables, conversationId, payments, refunds, disputes, reviews } = detail;
  const status = order.status as OrderStatus;
  const scope = (order.scope_snapshot ?? {}) as Scope;
  const counterpart = viewer === "buyer" ? order.specialist : order.buyer;
  const actions = viewer === "admin" ? [] : availableActions(status, viewer);
  const remaining = revisionsRemaining({ revisionsIncluded: order.revisions_included, revisionsUsed: order.revisions_used });
  const pendingDeliverables = deliverables.filter((d) => d.submission_id === null);
  const openDispute = disputes.find((d) => d.status === "open");
  const myReview = reviews.find((r) => r.reviewer_id === viewerId);
  const theirReview = reviews.find((r) => r.reviewee_id === viewerId);
  const canDispute = actions.includes("open_dispute");

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{order.order_number}</span>
          <span>·</span>
          <span>{order.source === "service" ? "Predefined gig" : "Custom requirement"}</span>
          {scope.category ? (
            <>
              <span>·</span>
              <span>{scope.category}</span>
            </>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{order.title}</h1>
          <OrderStatusBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {viewer === "admin" ? (
            <>
              <Party label="Buyer" person={order.buyer} />
              <Party label="Specialist" person={order.specialist} />
            </>
          ) : (
            <Party label={viewer === "buyer" ? "Specialist" : "Buyer"} person={counterpart} />
          )}
          <div>
            <p className="text-xs text-muted-foreground">{viewer === "specialist" ? "Order value" : "Total"}</p>
            <p className="font-display text-lg font-bold">{formatMoney(viewer === "specialist" ? order.price_minor : (order.total_minor ?? order.price_minor), order.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Delivery</p>
            <p className="inline-flex items-center gap-1 text-sm font-semibold">
              <CalendarClock className="size-4" aria-hidden />
              {order.delivery_deadline ? `Due ${formatDateTime(order.delivery_deadline)}` : `${formatDeliveryTime(order.delivery_time_hours)} after acceptance`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revisions</p>
            <p className="inline-flex items-center gap-1 text-sm font-semibold">
              <Repeat className="size-4" aria-hidden /> {order.revisions_used} of {order.revisions_included} used
            </p>
          </div>
        </div>
        {viewer !== "admin" ? <p className="rounded-2xl bg-brand-soft/50 p-3 text-sm font-medium text-ink">{nextStepHint(status, viewer)}</p> : null}
        {conversationId ? (
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/messages/${conversationId}`}>
                <MessageSquare aria-hidden /> {viewer === "admin" ? "View conversation" : "Messages"}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      {viewer === "buyer" && status === "pending_payment" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={`/dashboard/orders/${order.id}/checkout`}>
                <CreditCard aria-hidden /> Complete payment
              </Link>
            </Button>
            <TransitionButton
              orderId={order.id}
              action="cancel"
              label="Cancel order"
              variant="ghost"
              dialog={{ title: "Cancel this order?", description: "No payment has been taken, so nothing is charged.", noteLabel: "Reason", confirmLabel: "Cancel order", tone: "danger" }}
            />
          </CardContent>
        </Card>
      ) : null}

      {viewer === "specialist" && status === "pending_payment" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-soft">The buyer hasn&apos;t paid yet. You&apos;ll be notified when payment is verified.</p>
            <TransitionButton
              orderId={order.id}
              action="cancel"
              label="Cancel order"
              variant="ghost"
              size="sm"
              dialog={{ title: "Cancel this order?", description: "The buyer hasn't paid yet. Let them know why.", noteLabel: "Reason", confirmLabel: "Cancel order", tone: "danger" }}
            />
          </CardContent>
        </Card>
      ) : null}

      {viewer === "specialist" && status === "paid" ? (
        <Card className="border-brand/40">
          <CardHeader>
            <CardTitle>Payment verified — accept to start</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <TransitionButton orderId={order.id} action="accept" label="Accept & start work" />
            <TransitionButton
              orderId={order.id}
              action="decline"
              label="Decline"
              variant="outline"
              dialog={{
                title: "Decline this order?",
                description: "The buyer will be refunded in full through the payment provider.",
                noteLabel: "Reason for the buyer",
                minNote: 5,
                confirmLabel: "Decline order",
                tone: "danger",
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {viewer === "buyer" && status === "paid" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-soft">Waiting for the specialist to accept. Changed your mind?</p>
            <TransitionButton
              orderId={order.id}
              action="cancel"
              label="Cancel & request refund"
              variant="ghost"
              size="sm"
              dialog={{ title: "Cancel this order?", description: "Work hasn't started, so you'll be refunded in full through the payment provider.", noteLabel: "Reason", confirmLabel: "Cancel order", tone: "danger" }}
            />
          </CardContent>
        </Card>
      ) : null}

      {viewer === "specialist" && (status === "in_progress" || status === "revision_requested") ? (
        <Card className="border-brand/40">
          <CardHeader>
            <CardTitle>{status === "revision_requested" ? "Revision requested" : "Deliver your work"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {status === "revision_requested" ? <RevisionNote events={events} /> : null}
            <DeliverableManager orderId={order.id} pending={pendingDeliverables} isRevision={status === "revision_requested"} />
          </CardContent>
        </Card>
      ) : null}

      {viewer === "buyer" && status === "submitted" ? (
        <Card className="border-brand/40">
          <CardHeader>
            <CardTitle>Review the delivery</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">Check the deliverables below. Approving completes the order and confirms the work matches the agreed scope.</p>
            <div className="flex flex-wrap gap-3">
              <TransitionButton
                orderId={order.id}
                action="approve"
                label="Approve & complete"
                dialog={{ title: "Approve this delivery?", description: "The order will be marked complete. This can't be undone.", confirmLabel: "Approve" }}
              />
              {remaining > 0 ? (
                <TransitionButton
                  orderId={order.id}
                  action="request_revision"
                  label={`Request revision (${remaining} left)`}
                  variant="outline"
                  dialog={{
                    title: "Request a revision",
                    description: `You have ${remaining} of ${order.revisions_included} revision(s) left. Be specific about what should change.`,
                    noteLabel: "What needs to change?",
                    minNote: 10,
                    confirmLabel: "Send revision request",
                  }}
                />
              ) : (
                <p className="self-center text-sm text-muted-foreground">All included revisions used.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {openDispute ? (
        <Alert tone="danger" title="Dispute in progress">
          {DISPUTE_REASON_LABELS[openDispute.reason] ?? openDispute.reason} — opened {formatDateTime(openDispute.created_at)}. Our team will review the order history and contact both parties.
        </Alert>
      ) : null}

      {status === "completed" && viewer !== "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>{myReview ? "Your review" : "Leave a review"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {myReview ? (
              <div className="flex flex-col gap-1">
                <StarRow rating={myReview.rating} />
                {myReview.comment ? <p className="text-sm text-ink-soft">{myReview.comment}</p> : null}
              </div>
            ) : (
              <ReviewForm orderId={order.id} revieweeName={counterpart?.full_name ?? "them"} isBuyer={viewer === "buyer"} />
            )}
            {theirReview ? (
              <div className="flex flex-col gap-1 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Their review of you</p>
                <StarRow rating={theirReview.rating} />
                {theirReview.comment ? <p className="text-sm text-ink-soft">{theirReview.comment}</p> : null}
              </div>
            ) : null}
            {viewer === "buyer" && order.specialist ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button asChild>
                  <Link href={`/dashboard/buyer/requirements/new?invite=${order.specialist.username}`}>
                    <Repeat aria-hidden /> Hire again
                  </Link>
                </Button>
                {scope.service_slug ? (
                  <Button asChild variant="outline">
                    <Link href={`/gigs/${scope.service_slug}`}>Order this gig again</Link>
                  </Button>
                ) : null}
                <Button asChild variant="ghost">
                  <Link href={`/specialists/${order.specialist.username}`}>View their services</Link>
                </Button>
              </div>
            ) : null}
            {viewer === "specialist" ? (
              <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                Payout status: <span className="font-semibold text-ink">{order.payout_status === "paid_out" ? "Paid out" : "Pending manual settlement"}</span>. Payouts are
                settled by the Workido team outside the platform until automated settlement is enabled.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Deliveries */}
          <Card>
            <CardHeader>
              <CardTitle>Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliveries yet.</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {[...submissions].reverse().map((submission) => (
                    <li key={submission.id} className="rounded-2xl border border-border p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <Badge tone="dark">Version {submission.version}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(submission.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-line text-sm text-ink-soft">{submission.message}</p>
                      <ul className="mt-3 flex flex-col gap-2">
                        {deliverables
                          .filter((d) => d.submission_id === submission.id)
                          .map((d) => (
                            <li key={d.id}>
                              {d.kind === "file" && d.storage_path ? (
                                <a href={privateFileHref("order-files", d.storage_path, d.filename)} className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                                  <Paperclip className="size-4" aria-hidden /> {d.filename}
                                  {d.size_bytes ? <span className="text-xs text-muted-foreground">{formatFileSize(d.size_bytes)}</span> : null}
                                </a>
                              ) : d.external_url ? (
                                <a href={d.external_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 text-sm font-medium text-brand-text hover:underline">
                                  <Link2 className="size-4" aria-hidden /> {d.filename} <ExternalLink className="size-3.5" aria-hidden />
                                </a>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Scope */}
          <Card>
            <CardHeader>
              <CardTitle>Agreed scope</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <p className="text-xs text-muted-foreground">This is a snapshot taken when the order was created. Later edits to the listing don&apos;t change it.</p>
              {scope.deliverables ? <ScopeItem label="Deliverables" value={scope.deliverables} /> : null}
              {scope.description ? <ScopeItem label="Description" value={scope.description} /> : null}
              {scope.offer_message ? <ScopeItem label="Specialist's offer" value={scope.offer_message} /> : null}
              {order.buyer_brief && order.source === "service" ? <ScopeItem label="Buyer's requirements" value={order.buyer_brief} /> : null}
              {scope.quantity ? <ScopeItem label="Quantity" value={String(scope.quantity)} /> : null}
              {scope.reference_links && scope.reference_links.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference links</p>
                  {scope.reference_links.map((link) => (
                    <a key={link} href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand-text hover:underline">
                      {link}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {disputes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Scale className="size-5" aria-hidden /> Disputes
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {disputes.map((dispute) => (
                  <div key={dispute.id} className="rounded-2xl border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={dispute.status === "open" ? "danger" : "neutral"} className="capitalize">
                        {dispute.status}
                      </Badge>
                      <span className="font-semibold">{DISPUTE_REASON_LABELS[dispute.reason] ?? dispute.reason}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(dispute.created_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-ink-soft">{dispute.description}</p>
                    {dispute.resolution ? (
                      <p className="mt-2 rounded-xl bg-mist p-3">
                        <span className="font-semibold">Resolution:</span> {dispute.resolution}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <History className="size-5" aria-hidden /> History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
                {events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-brand ring-4 ring-card" aria-hidden />
                    <p className="text-sm font-semibold">{orderEventLabel(event.event_type)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                    {typeof (event.metadata as { note?: unknown }).note === "string" ? (
                      <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">“{(event.metadata as { note: string }).note}”</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {viewer !== "specialist" && (payments.length > 0 || refunds.length > 0) ? (
            <Card>
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <CreditCard className="size-5" aria-hidden /> Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-2">
                    <span>
                      {formatMoney(payment.amount_minor, payment.currency)} <span className="text-xs text-muted-foreground">via {payment.provider === "dev" ? "test mode" : payment.provider}</span>
                    </span>
                    <Badge tone={payment.status === "succeeded" ? "success" : payment.status === "failed" ? "danger" : "neutral"} className="capitalize">
                      {payment.status === "created" ? "started" : payment.status}
                    </Badge>
                  </div>
                ))}
                {refunds.map((refund) => (
                  <div key={refund.id} className="flex items-center justify-between gap-2">
                    <span>Refund {formatMoney(refund.amount_minor, refund.currency)}</span>
                    <Badge tone={refund.status === "succeeded" ? "success" : refund.status === "failed" ? "danger" : "warning"} className="capitalize">
                      {refund.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {canDispute && !openDispute ? (
            <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-ink/15 p-4">
              <p className="text-sm font-semibold">Problem with this order?</p>
              <p className="text-xs text-muted-foreground">Try messaging first. If you can&apos;t resolve it, our team can step in.</p>
              <DisputeButton orderId={order.id} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Party({ label, person }: { label: string; person: { full_name: string; username: string; avatar_path: string | null } | null }) {
  if (!person) return null;
  return (
    <div className="flex items-center gap-2">
      <Avatar name={person.full_name} path={person.avatar_path} size="sm" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{person.full_name}</p>
      </div>
    </div>
  );
}

function ScopeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line text-ink-soft">{value}</p>
    </div>
  );
}

function RevisionNote({ events }: { events: OrderDetail["events"] }) {
  const latest = [...events].reverse().find((event) => event.event_type === "revision_requested");
  const note = latest ? (latest.metadata as { note?: string }).note : null;
  if (!note) return null;
  return (
    <Alert tone="warning" title="The buyer asked for these changes">
      <span className="whitespace-pre-line">{note}</span>
    </Alert>
  );
}
