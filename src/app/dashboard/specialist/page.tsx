import { ArrowRight, CircleCheck, Circle, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderList, StatCard } from "@/components/orders/order-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { AvailabilityDot, PageHeader, VerifiedBadge } from "@/components/ui/misc";
import { requireSpecialist } from "@/lib/auth/session";
import { countOrders, listOrders } from "@/lib/data/orders";
import { getMySpecialistWorkspace, onboardingSteps } from "@/lib/data/specialist";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Selling overview" };

export default async function SpecialistOverviewPage() {
  const user = await requireSpecialist();
  const supabase = await createSupabaseServerClient();
  const [workspace, needsAction, activeCount, completedCount, invitations] = await Promise.all([
    getMySpecialistWorkspace(user.id),
    listOrders(user.id, "specialist", ["paid", "in_progress", "revision_requested"], 10),
    countOrders(user.id, "specialist", ["paid", "in_progress", "submitted", "revision_requested", "disputed"]),
    countOrders(user.id, "specialist", ["completed"]),
    supabase.from("requirement_invitations").select("id", { count: "exact", head: true }).eq("specialist_id", user.id).eq("status", "invited"),
  ]);
  const steps = onboardingSteps(workspace);
  const remaining = steps.filter((step) => !step.done);
  const profile = workspace.profile;

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title={`Hi, ${user.fullName.split(" ")[0]}`}
        description="Accept new orders, deliver great work and keep your profile up to date."
        actions={
          profile?.is_published ? (
            <Button asChild variant="outline">
              <Link href={`/specialists/${user.username}`}>View public profile</Link>
            </Button>
          ) : null
        }
      />

      {remaining.length > 0 ? (
        <Card className="border-brand/30 bg-brand-soft/40">
          <CardHeader>
            <CardTitle>Finish setting up ({steps.length - remaining.length}/{steps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2">
              {steps.map((step) => (
                <li key={step.key}>
                  <Link href={step.href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-card">
                    {step.done ? <CircleCheck className="size-5 text-mint-text" aria-hidden /> : <Circle className="size-5 text-ink/30" aria-hidden />}
                    <span className={step.done ? "text-ink-soft line-through" : "font-semibold"}>{step.label}</span>
                    {!step.done ? <ArrowRight className="ml-auto size-4" aria-hidden /> : null}
                    <span className="sr-only">{step.done ? "(done)" : "(to do)"}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active orders" value={activeCount} href="/dashboard/specialist/orders" />
        <StatCard label="New invitations" value={invitations.count ?? 0} href="/dashboard/specialist/opportunities" />
        <StatCard label="Completed orders" value={completedCount} href="/dashboard/specialist/orders?tab=completed" />
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-5">
          <span className="text-sm font-semibold text-ink-soft">Status</span>
          {profile ? <AvailabilityDot status={profile.availability_status} /> : null}
          <span className="text-xs text-muted-foreground">{profile?.is_published ? "Profile published" : "Profile not published"}</span>
          <VerifiedBadge status={profile?.verification_status ?? "not_submitted"} />
          <Link href="/dashboard/specialist/availability" className="text-xs font-semibold text-brand-text hover:underline">
            Change availability
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">Needs your attention</h2>
        {needsAction.length > 0 ? (
          <OrderList orders={needsAction} viewer="specialist" />
        ) : (
          <EmptyState
            icon={Inbox}
            title="You're all caught up"
            description="New paid orders and revision requests will appear here."
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard/specialist/opportunities">See opportunities</Link>
              </Button>
            }
          />
        )}
      </section>
    </>
  );
}
