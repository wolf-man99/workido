import { ChevronRight, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireSpecialist } from "@/lib/auth/session";
import { listOpportunities } from "@/lib/data/requirements";
import { formatBudgetRange } from "@/lib/domain/money";
import { URGENCY_LABELS, formatDate, formatRelativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Opportunities" };

const INVITE_STATUS = {
  invited: { label: "Awaiting your offer", tone: "brand" },
  offered: { label: "Offer sent", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
} as const;

export default async function OpportunitiesPage() {
  const user = await requireSpecialist();
  const invitations = await listOpportunities(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Opportunities"
        description="Buyers invite specialists who match their task. Send an offer with your price and timeline — there's no public bidding."
      />
      {invitations.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No invitations yet"
          description="Keep your skills, services, portfolio and availability up to date to appear in more matches."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {invitations.map((invitation) => {
            const requirement = invitation.requirement;
            if (!requirement) return null;
            const status = INVITE_STATUS[invitation.status];
            const closed = requirement.status !== "open";
            return (
              <li key={invitation.id}>
                <Link href={`/dashboard/specialist/opportunities/${requirement.id}`} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4 transition-colors hover:border-ink/25 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-bold">{requirement.title}</p>
                      {closed ? <Badge>{requirement.status === "hired" ? "Filled" : "Closed"}</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
                      {requirement.urgency === "urgent" && !closed ? <Badge tone="warning">{URGENCY_LABELS.urgent}</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {requirement.category?.name} · {formatBudgetRange(requirement.budget_min_minor, requirement.budget_max_minor, requirement.currency)}
                      {requirement.deadline_at ? ` · due ${formatDate(requirement.deadline_at)}` : ""} · invited {formatRelativeTime(invitation.invited_at)}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-ink/40" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
