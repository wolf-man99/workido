import { Check, Clock, ExternalLink, Paperclip, Pencil, RefreshCw, Repeat, Send, Sparkles, Trash2, UserPlus, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackEvent } from "@/components/dashboard/track-event";
import { ActionButton } from "@/components/forms/action-button";
import { AcceptOfferButton } from "@/components/forms/offer-forms";
import { OrderStatusBadge } from "@/components/orders/order-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { AvailabilityDot, PageHeader, RatingSummary, SampleBadge, VerifiedBadge } from "@/components/ui/misc";
import {
  closeRequirementAction,
  declineOfferAction,
  deleteDraftRequirementAction,
  inviteSpecialistsAction,
  refreshMatchesAction,
} from "@/lib/actions/requirements";
import { requireUser } from "@/lib/auth/session";
import { getRequirementForOwner } from "@/lib/data/requirements";
import { matchLabel } from "@/lib/domain/matching/engine";
import { formatBudgetRange, formatMoney } from "@/lib/domain/money";
import { EXPERIENCE_LABELS, URGENCY_LABELS, formatDate, formatDeliveryTime, formatFileSize, formatRelativeTime } from "@/lib/format";
import { privateFileHref } from "@/lib/storage/server";
import type { OrderStatus } from "@/lib/domain/orders/state-machine";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Requirement" };

const STATUS_TONE = { draft: "neutral", open: "brand", hired: "success", closed: "neutral" } as const;

export default async function RequirementDetailPage(props: PageProps<"/dashboard/buyer/requirements/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/buyer/requirements/${id}`);
  const data = await getRequirementForOwner(id, user.id);
  if (!data) notFound();
  const { requirement, attachments, matches, invitations, offers, order, people } = data;
  const invitationBySpecialist = new Map(invitations.map((invitation) => [invitation.specialist_id, invitation]));
  const isOpen = requirement.status === "open";
  const pendingOffers = offers.filter((offer) => offer.status === "pending");
  const uninvitedTop = matches.filter((match) => !invitationBySpecialist.has(match.specialist_id)).slice(0, 3);
  const invitedNotMatched = invitations.filter((invitation) => !matches.some((match) => match.specialist_id === invitation.specialist_id));

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/buyer/requirements" className="hover:underline">
            My requirements
          </Link>
        }
        title={requirement.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[requirement.status]} className="capitalize">
              {requirement.status}
            </Badge>
            <span>Posted {formatRelativeTime(requirement.submitted_at ?? requirement.created_at)}</span>
          </span>
        }
        actions={
          <>
            {requirement.status === "draft" || isOpen ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/buyer/requirements/${requirement.id}/edit`}>
                  <Pencil aria-hidden /> {requirement.status === "draft" ? "Continue editing" : "Edit"}
                </Link>
              </Button>
            ) : null}
            {isOpen ? (
              <ActionButton
                variant="ghost"
                action={closeRequirementAction.bind(null, requirement.id)}
                confirm={{ title: "Close this requirement?", description: "Specialists won't be able to send new offers. Pending offers stay visible.", confirmLabel: "Close requirement" }}
              >
                <XCircle aria-hidden /> Close
              </ActionButton>
            ) : null}
            {requirement.status === "draft" ? (
              <ActionButton
                variant="ghost"
                action={deleteDraftRequirementAction.bind(null, requirement.id)}
                redirectTo="/dashboard/buyer/requirements"
                confirm={{ title: "Delete this draft?", description: "This can't be undone.", confirmLabel: "Delete", tone: "danger" }}
              >
                <Trash2 aria-hidden /> Delete
              </ActionButton>
            ) : null}
          </>
        }
      />

      {order ? (
        <Alert tone="success" title="You hired a specialist for this task">
          <span className="flex flex-wrap items-center gap-2">
            Order {order.order_number} <OrderStatusBadge status={order.status as OrderStatus} />
            <Link href={`/dashboard/orders/${order.id}`} className="font-semibold underline">
              Open order
            </Link>
          </span>
        </Alert>
      ) : null}

      {/* Offers */}
      {offers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold">
            Offers <span className="text-base font-normal text-muted-foreground">({pendingOffers.length} pending)</span>
          </h2>
          <ul className="grid gap-3 xl:grid-cols-2">
            {offers.map((offer) => {
              const person = people.get(offer.specialist_id);
              return (
                <li key={offer.id} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={person?.full_name ?? "?"} path={person?.avatar_path} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/specialists/${person?.username ?? ""}`} className="font-semibold hover:underline">
                        {person?.full_name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <RatingSummary ratingAvg={person?.specialist?.rating_avg ?? null} ratingCount={person?.specialist?.rating_count ?? 0} />
                        <VerifiedBadge status={person?.specialist?.verification_status ?? "not_submitted"} />
                      </div>
                    </div>
                    <Badge tone={offer.status === "pending" ? "brand" : offer.status === "accepted" ? "success" : "neutral"} className="capitalize">
                      {offer.status}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-mist/60 p-3 text-center">
                    <div>
                      <dt className="text-xs text-muted-foreground">Price</dt>
                      <dd className="font-display font-bold">{formatMoney(offer.proposed_price_minor, offer.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Delivery</dt>
                      <dd className="font-display font-bold">{formatDeliveryTime(offer.delivery_time_hours)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Revisions</dt>
                      <dd className="font-display font-bold">{offer.revisions_included}</dd>
                    </div>
                  </dl>
                  <p className="whitespace-pre-line text-sm text-ink-soft">{offer.message}</p>
                  {offer.status === "pending" && isOpen ? (
                    <div className="flex flex-wrap gap-2">
                      <AcceptOfferButton
                        offerId={offer.id}
                        summary={`${person?.full_name}: ${formatMoney(offer.proposed_price_minor, offer.currency)}, ${formatDeliveryTime(offer.delivery_time_hours)}, ${offer.revisions_included} revision(s).`}
                      />
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={declineOfferAction.bind(null, offer.id)}
                        confirm={{ title: "Decline this offer?", description: "The specialist will be notified.", confirmLabel: "Decline" }}
                      >
                        Decline
                      </ActionButton>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Matches */}
      {isOpen ? (
        <section className="flex flex-col gap-3">
          <TrackEvent event="match_results_viewed" properties={{ requirement_id: requirement.id, matches: matches.length }} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Your shortlist</h2>
              <p className="text-sm text-muted-foreground">
                Ranked by skills, category, availability, delivery time, budget and portfolio evidence. Invite the people you like — they&apos;ll send an offer.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {uninvitedTop.length > 1 ? (
                <ActionButton size="sm" action={inviteSpecialistsAction.bind(null, requirement.id, uninvitedTop.map((m) => m.specialist_id))}>
                  <Send aria-hidden /> Invite top {uninvitedTop.length}
                </ActionButton>
              ) : null}
              <ActionButton size="sm" variant="outline" action={refreshMatchesAction.bind(null, requirement.id)}>
                <RefreshCw aria-hidden /> Refresh
              </ActionButton>
            </div>
          </div>
          {matches.length === 0 && !requirement.matches_computed_at ? (
            <EmptyState
              icon={Sparkles}
              title="Find suitable specialists"
              description="Run matching to get a short, ranked list of specialists for this task."
              action={
                <ActionButton action={refreshMatchesAction.bind(null, requirement.id)}>
                  <Sparkles aria-hidden /> Find matches
                </ActionButton>
              }
            />
          ) : matches.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No strong matches right now"
              description="Try relaxing must-have skills, extending the deadline or adjusting the budget. You can also invite specialists directly from their profiles."
              action={
                <Button asChild variant="outline">
                  <Link href="/specialists">Browse specialists</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {matches.map((match) => {
                const person = people.get(match.specialist_id);
                const invitation = invitationBySpecialist.get(match.specialist_id);
                return (
                  <li key={match.specialist_id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={person?.full_name ?? "?"} path={person?.avatar_path} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/specialists/${person?.username ?? ""}`} className="font-semibold hover:underline">
                          {person?.full_name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{person?.specialist?.headline}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {person?.specialist ? <AvailabilityDot status={person.specialist.availability_status} /> : null}
                          <RatingSummary ratingAvg={person?.specialist?.rating_avg ?? null} ratingCount={person?.specialist?.rating_count ?? 0} />
                          <VerifiedBadge status={person?.specialist?.verification_status ?? "not_submitted"} />
                          <SampleBadge isSample={Boolean(person?.is_sample)} />
                        </div>
                      </div>
                      <Badge tone={Number(match.score) >= 75 ? "success" : "brand"}>{matchLabel(Number(match.score))}</Badge>
                    </div>
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {match.reasons.map((reason) => (
                        <li key={reason} className="flex items-center gap-2 text-ink-soft">
                          <Check className="size-4 text-mint-text" aria-hidden /> {reason}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto">
                      {invitation ? (
                        <Badge tone={invitation.status === "offered" ? "success" : invitation.status === "declined" ? "neutral" : "brand"}>
                          {invitation.status === "offered" ? "Offer received" : invitation.status === "declined" ? "Declined" : "Invited"}
                        </Badge>
                      ) : (
                        <ActionButton size="sm" variant="outline" action={inviteSpecialistsAction.bind(null, requirement.id, [match.specialist_id])}>
                          <UserPlus aria-hidden /> Invite
                        </ActionButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {invitedNotMatched.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Also invited:{" "}
              {invitedNotMatched.map((invitation) => people.get(invitation.specialist_id)?.full_name).filter(Boolean).join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Task details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="whitespace-pre-line text-ink-soft">{requirement.description || "No description yet."}</p>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Category" value={[requirement.category?.name, requirement.subcategory?.name].filter(Boolean).join(" › ") || "—"} />
            <Detail label="Budget" value={formatBudgetRange(requirement.budget_min_minor, requirement.budget_max_minor, requirement.currency)} />
            <Detail label="Deadline" value={requirement.deadline_at ? formatDate(requirement.deadline_at) : "Flexible"} icon={<Clock className="size-4" aria-hidden />} />
            <Detail label="Urgency" value={URGENCY_LABELS[requirement.urgency]} />
            <Detail
              label="Items / revisions"
              value={`${requirement.quantity === null ? "—" : pluralize(requirement.quantity, "item")} · ${requirement.revisions_expected === null ? "— revisions" : pluralize(requirement.revisions_expected, "revision")}`}
              icon={<Repeat className="size-4" aria-hidden />}
            />
            <Detail label="Experience" value={requirement.preferred_experience ? EXPERIENCE_LABELS[requirement.preferred_experience] : "No preference"} />
            <Detail label="Location" value={`${requirement.location_preference ?? "Anywhere"}${requirement.remote_ok ? " · remote OK" : ""}`} />
            <Detail
              label="Skills"
              value={requirement.requirement_skills.length ? requirement.requirement_skills.map((s) => `${s.skills?.name ?? ""}${s.is_mandatory ? " (must have)" : ""}`).join(", ") : "Any"}
            />
          </dl>
          {requirement.deliverables ? <Detail label="Deliverables" value={requirement.deliverables} /> : null}
          {requirement.reference_links.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference links</span>
              {requirement.reference_links.map((link) => (
                <a key={link} href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-sm font-medium text-brand-text hover:underline">
                  {link} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              ))}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</span>
              <ul className="flex flex-col gap-2">
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a href={privateFileHref("requirement-files", attachment.storage_path, attachment.filename)} className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                      <Paperclip className="size-4" aria-hidden /> {attachment.filename} <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size_bytes)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="inline-flex items-center gap-1.5 whitespace-pre-line text-ink">
        {icon}
        {value}
      </dd>
    </div>
  );
}
