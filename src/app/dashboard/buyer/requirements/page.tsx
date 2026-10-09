import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { listMyRequirements } from "@/lib/data/requirements";
import { formatBudgetRange } from "@/lib/domain/money";
import { formatDate, formatRelativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "My requirements" };

const STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "brand" },
  hired: { label: "Hired", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
} as const;

export default async function RequirementsPage() {
  const user = await requireUser("/dashboard/buyer/requirements");
  const requirements = await listMyRequirements(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Hiring"
        title="My requirements"
        description="Custom tasks you've posted, with matches and offers."
        actions={
          <Button asChild>
            <Link href="/dashboard/buyer/requirements/new">
              <Plus aria-hidden /> Post a task
            </Link>
          </Button>
        }
      />
      {requirements.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No requirements yet"
          description="Can't find the right gig? Describe your task and we'll match you with suitable specialists."
          action={
            <Button asChild>
              <Link href="/dashboard/buyer/requirements/new">Post your first task</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {requirements.map((requirement) => {
            const status = STATUS[requirement.status];
            const href = requirement.status === "draft" ? `/dashboard/buyer/requirements/${requirement.id}/edit` : `/dashboard/buyer/requirements/${requirement.id}`;
            return (
              <li key={requirement.id}>
                <Link href={href} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-4 transition-colors hover:border-ink/25 sm:flex-row sm:items-center sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-bold">{requirement.title}</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {requirement.categories?.name ?? "No category"} · {formatBudgetRange(requirement.budget_min_minor, requirement.budget_max_minor, requirement.currency)}
                      {requirement.deadline_at ? ` · due ${formatDate(requirement.deadline_at)}` : ""} · updated {formatRelativeTime(requirement.updated_at)}
                    </p>
                  </div>
                  {requirement.status === "open" ? (
                    <div className="flex gap-2 text-sm">
                      <Badge tone="outline">{requirement.invitationCount} invited</Badge>
                      <Badge tone={requirement.offerCount > 0 ? "success" : "outline"}>
                        {requirement.offerCount} offer{requirement.offerCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
