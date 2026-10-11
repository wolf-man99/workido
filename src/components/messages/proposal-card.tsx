"use client";

import { FileSignature, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/submit-button";
import { acceptProposalAction, declineProposalAction, respondToCounterAction, withdrawProposalAction } from "@/lib/actions/proposals";
import type { ActionResult } from "@/lib/actions/result";
import { isProposalOpen, type ProposalView } from "@/lib/chat/messages";
import { formatMoney } from "@/lib/domain/money";
import { formatDate, formatDeliveryTime } from "@/lib/format";
import { cn, pluralize } from "@/lib/utils";
import { CounterOfferButton } from "./proposal-forms";

function statusBadge(proposal: ProposalView, open: boolean) {
  if (proposal.status === "accepted") return <Badge tone="success">Accepted</Badge>;
  if (proposal.status === "declined") return <Badge tone="danger">Declined</Badge>;
  if (proposal.status === "withdrawn") return <Badge>Withdrawn</Badge>;
  if (!open) return <Badge>Expired</Badge>;
  if (proposal.status === "countered") return <Badge tone="warning">Counter-offer</Badge>;
  return <Badge tone="brand">Open</Badge>;
}

/**
 * A proposal inside the pre-order chat, with the actions each side can take.
 * Rules (one counter-offer, expiry, order creation) live in the database.
 */
export function ProposalCard({
  proposal,
  viewerId,
  names,
  onChanged,
  className,
}: {
  proposal: ProposalView;
  viewerId: string;
  names: Record<string, string>;
  onChanged: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const isBuyer = viewerId === proposal.buyer_id;
  const isSpecialist = viewerId === proposal.specialist_id;
  const buyerName = names[proposal.buyer_id] ?? "The buyer";
  const specialistName = names[proposal.specialist_id] ?? "The specialist";
  const open = isProposalOpen(proposal);
  const hasCounter = proposal.counter_price_minor !== null && proposal.counter_delivery_time_hours !== null;
  const agreedCounter = proposal.status === "accepted" && proposal.accepted_terms === "counter";
  const price = agreedCounter ? proposal.counter_price_minor! : proposal.price_minor;
  const hours = agreedCounter ? proposal.counter_delivery_time_hours! : proposal.delivery_time_hours;

  function run(name: string, action: () => Promise<ActionResult<unknown>>, after?: (result: ActionResult<unknown>) => void) {
    setBusyAction(name);
    startTransition(async () => {
      const result = await action();
      setBusyAction(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      onChanged();
      after?.(result);
    });
  }

  return (
    <article
      className={cn("flex w-full max-w-md flex-col gap-3 rounded-2xl border-2 border-brand/30 bg-card p-4 text-sm shadow-[var(--shadow-soft)]", className)}
      aria-label={`Proposal: ${proposal.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FileSignature className="size-4 text-brand-text" aria-hidden /> Proposal from {isSpecialist ? "you" : specialistName}
        </p>
        {statusBadge(proposal, open)}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold leading-snug">{proposal.title}</h3>
        <p className="mt-1 text-ink-soft">
          <span className="font-display text-2xl font-bold text-ink">{formatMoney(price, proposal.currency)}</span> · {formatDeliveryTime(hours)} ·{" "}
          {pluralize(proposal.revisions_included, "revision")}
        </p>
        {agreedCounter ? <p className="text-xs text-muted-foreground">Agreed at the counter-offer terms.</p> : null}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-brand-text">Scope and deliverables</summary>
        <div className="mt-2 flex flex-col gap-2">
          <p className="whitespace-pre-line text-ink-soft">{proposal.description}</p>
          <p className="whitespace-pre-line">
            <span className="font-semibold">You receive: </span>
            {proposal.deliverables}
          </p>
        </div>
      </details>

      {hasCounter && !agreedCounter ? (
        <div className="rounded-xl bg-sun-soft p-3">
          <p className="font-semibold">
            {isBuyer ? "Your counter-offer" : `Counter-offer from ${buyerName}`}: {formatMoney(proposal.counter_price_minor!, proposal.currency)} ·{" "}
            {formatDeliveryTime(proposal.counter_delivery_time_hours!)}
          </p>
          {proposal.counter_note ? <p className="mt-1 whitespace-pre-line text-ink-soft">{proposal.counter_note}</p> : null}
          {proposal.counter_declined_at ? (
            <p className="mt-1 text-xs text-muted-foreground">{isSpecialist ? "You declined it" : `${specialistName} declined it`}; the original proposal still stands.</p>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      {proposal.status === "accepted" && proposal.order ? (
        <div className="flex flex-col gap-2">
          {isBuyer && proposal.order.status === "pending_payment" ? (
            <Button asChild>
              <Link href={`/dashboard/orders/${proposal.order.id}/checkout`}>Pay {formatMoney(price, proposal.currency)} on Workido</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/dashboard/orders/${proposal.order.id}`}>View order {proposal.order.order_number}</Link>
            </Button>
          )}
        </div>
      ) : open && isBuyer && proposal.status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          <PendingButton
            size="sm"
            pending={pending && busyAction === "accept"}
            pendingLabel="Creating order…"
            disabled={pending}
            onClick={() =>
              run(
                "accept",
                () => acceptProposalAction(proposal.id),
                (result) => {
                  if (result.ok) router.push(`/dashboard/orders/${(result.data as { orderId: string }).orderId}/checkout`);
                },
              )
            }
          >
            Accept & pay
          </PendingButton>
          {!hasCounter ? (
            <CounterOfferButton
              proposalId={proposal.id}
              priceMinor={proposal.price_minor}
              deliveryTimeHours={proposal.delivery_time_hours}
              specialistName={specialistName}
              onSent={onChanged}
            />
          ) : null}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("decline", () => declineProposalAction(proposal.id))}>
            Decline
          </Button>
        </div>
      ) : open && isBuyer && proposal.status === "countered" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">Waiting for {specialistName} to answer your counter-offer.</p>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("decline", () => declineProposalAction(proposal.id))}>
            Decline proposal
          </Button>
        </div>
      ) : open && isSpecialist && proposal.status === "countered" ? (
        <div className="flex flex-wrap gap-2">
          <PendingButton
            size="sm"
            pending={pending && busyAction === "accept-counter"}
            pendingLabel="Accepting…"
            disabled={pending}
            onClick={() => run("accept-counter", () => respondToCounterAction(proposal.id, true))}
          >
            Accept counter-offer
          </PendingButton>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("decline-counter", () => respondToCounterAction(proposal.id, false))}>
            Keep my proposal
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("withdraw", () => withdrawProposalAction(proposal.id))}>
            Withdraw
          </Button>
        </div>
      ) : open && isSpecialist ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">Waiting for {buyerName} to respond.</p>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("withdraw", () => withdrawProposalAction(proposal.id))}>
            Withdraw
          </Button>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-mint-text" aria-hidden />
        {open
          ? `Agreed and paid on Workido, this work is covered by disputes and refunds. Open until ${formatDate(proposal.expires_at)}.`
          : "Agreed and paid on Workido, this work is covered by disputes and refunds."}
      </p>
    </article>
  );
}
