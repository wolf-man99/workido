import { ExternalLink, Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { OfferForm } from "@/components/forms/offer-forms";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { declineInvitationAction, withdrawOfferAction } from "@/lib/actions/offers";
import { requireSpecialist } from "@/lib/auth/session";
import { getOpportunity } from "@/lib/data/requirements";
import { formatBudgetRange, formatMoney, minorToMajorInput } from "@/lib/domain/money";
import { EXPERIENCE_LABELS, URGENCY_LABELS, formatDate, formatDeliveryTime, formatFileSize } from "@/lib/format";
import { privateFileHref } from "@/lib/storage/server";
import { fromHours } from "@/lib/validation/marketplace";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage(props: PageProps<"/dashboard/specialist/opportunities/[id]">) {
  const { id } = await props.params;
  const user = await requireSpecialist();
  const data = await getOpportunity(id, user.id);
  if (!data) notFound();
  const { invitation, requirement, attachments, offer } = data;
  const isOpen = requirement.status === "open";
  const canOffer = isOpen && invitation.status !== "declined" && (!offer || offer.status !== "pending");
  const suggestedPrice = requirement.budget_max_minor ? minorToMajorInput(requirement.budget_max_minor, requirement.currency) : "";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/specialist/opportunities" className="hover:underline">
            Opportunities
          </Link>
        }
        title={requirement.title}
        description={`Budget ${formatBudgetRange(requirement.budget_min_minor, requirement.budget_max_minor, requirement.currency)}${requirement.deadline_at ? ` · due ${formatDate(requirement.deadline_at)}` : ""}`}
      />

      {!isOpen ? (
        <Alert tone="info">{requirement.status === "hired" ? "The buyer has hired a specialist for this task." : "This requirement is closed."}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar name={requirement.buyer?.full_name ?? "Buyer"} path={requirement.buyer?.avatar_path} />
            <div>
              <CardTitle>{requirement.buyer?.full_name}</CardTitle>
              <CardDescription>Invited you on {formatDate(invitation.invited_at)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="whitespace-pre-line text-ink-soft">{requirement.description}</p>
          <div className="flex flex-wrap gap-2">
            {requirement.category?.name ? <Badge tone="outline">{requirement.category.name}</Badge> : null}
            <Badge tone={requirement.urgency === "urgent" ? "warning" : "outline"}>{URGENCY_LABELS[requirement.urgency]}</Badge>
            {requirement.preferred_experience ? <Badge tone="outline">{EXPERIENCE_LABELS[requirement.preferred_experience]}</Badge> : null}
            {requirement.requirement_skills.map((skill) => (
              <Badge key={skill.skills?.name} tone={skill.is_mandatory ? "dark" : "neutral"}>
                {skill.skills?.name}
                {skill.is_mandatory ? " · must have" : ""}
              </Badge>
            ))}
          </div>
          {requirement.deliverables ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected deliverables</p>
              <p className="whitespace-pre-line text-sm">{requirement.deliverables}</p>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {requirement.quantity ? `${requirement.quantity} items · ` : ""}
            {requirement.revisions_expected !== null ? `${requirement.revisions_expected} revision(s) expected · ` : ""}
            {requirement.location_preference ? `Location: ${requirement.location_preference} · ` : ""}
            {requirement.remote_ok ? "Remote OK" : "On-site preferred"}
          </p>
          {requirement.reference_links.length > 0 ? (
            <div className="flex flex-col gap-1">
              {requirement.reference_links.map((link) => (
                <a key={link} href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-sm font-medium text-brand-text hover:underline">
                  {link} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              ))}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {attachments.map((attachment) => (
                <li key={attachment.id}>
                  <a href={privateFileHref("requirement-files", attachment.storage_path, attachment.filename)} className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                    <Paperclip className="size-4" aria-hidden /> {attachment.filename} <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size_bytes)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {offer ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Your offer</CardTitle>
              <Badge tone={offer.status === "accepted" ? "success" : offer.status === "pending" ? "brand" : "neutral"} className="capitalize">
                {offer.status}
              </Badge>
            </div>
            <CardDescription>
              {formatMoney(offer.proposed_price_minor, offer.currency)} · {formatDeliveryTime(offer.delivery_time_hours)} · {offer.revisions_included} revision(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {offer.status === "pending" && isOpen ? (
              <>
                <OfferForm
                  requirementId={requirement.id}
                  offerId={offer.id}
                  defaults={{
                    price: minorToMajorInput(offer.proposed_price_minor, offer.currency),
                    ...fromHours(offer.delivery_time_hours),
                    revisionsIncluded: String(offer.revisions_included),
                    message: offer.message,
                  }}
                />
                <ActionButton
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  action={withdrawOfferAction.bind(null, offer.id)}
                  confirm={{ title: "Withdraw your offer?", description: "You can send a new one while the task is open.", confirmLabel: "Withdraw" }}
                >
                  Withdraw offer
                </ActionButton>
              </>
            ) : (
              <p className="whitespace-pre-line text-sm text-ink-soft">{offer.message}</p>
            )}
            {offer.status === "accepted" ? (
              <p className="text-sm text-mint-text">Accepted! You&apos;ll be notified as soon as the buyer&apos;s payment is verified.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canOffer ? (
        <Card>
          <CardHeader>
            <CardTitle>{offer ? "Send a new offer" : "Send your offer"}</CardTitle>
            <CardDescription>Be clear about scope. The buyer pays the price you propose, and the order uses exactly this scope.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <OfferForm
              requirementId={requirement.id}
              defaults={{ price: suggestedPrice, deliveryValue: "3", deliveryUnit: "days", revisionsIncluded: String(requirement.revisions_expected ?? 1), message: "" }}
            />
            {invitation.status === "invited" ? (
              <ActionButton
                variant="ghost"
                size="sm"
                className="self-start"
                action={declineInvitationAction.bind(null, invitation.id)}
                confirm={{ title: "Decline this invitation?", description: "The buyer will see that you're not available for this task.", confirmLabel: "Decline" }}
              >
                Not for me — decline
              </ActionButton>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
