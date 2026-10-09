import { ClipboardList, Plus, Search, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderList, StatCard } from "@/components/orders/order-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { countOrders, listOrders } from "@/lib/data/orders";
import { listMyRequirements } from "@/lib/data/requirements";

export const metadata: Metadata = { title: "Hiring overview" };

export default async function BuyerOverviewPage() {
  const user = await requireUser("/dashboard/buyer");
  const [needsAction, activeCount, completedCount, requirements] = await Promise.all([
    listOrders(user.id, "buyer", ["pending_payment", "submitted"], 10),
    countOrders(user.id, "buyer", ["paid", "in_progress", "submitted", "revision_requested", "disputed"]),
    countOrders(user.id, "buyer", ["completed"]),
    listMyRequirements(user.id),
  ]);
  const open = requirements.filter((requirement) => requirement.status === "open");
  const drafts = requirements.filter((requirement) => requirement.status === "draft");

  return (
    <>
      <PageHeader
        eyebrow="Hiring"
        title={`Hi, ${user.fullName.split(" ")[0]}`}
        description="Track your tasks and orders, and get work done."
        actions={
          <>
            <Button asChild>
              <Link href="/dashboard/buyer/requirements/new">
                <Plus aria-hidden /> Post a task
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/gigs">
                <Search aria-hidden /> Browse gigs
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active orders" value={activeCount} href="/dashboard/buyer/orders" />
        <StatCard label="Open requirements" value={open.length} href="/dashboard/buyer/requirements" />
        <StatCard label="Offers waiting" value={open.reduce((sum, requirement) => sum + requirement.offerCount, 0)} href="/dashboard/buyer/requirements" />
        <StatCard label="Completed orders" value={completedCount} href="/dashboard/buyer/orders?tab=completed" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">Needs your attention</h2>
        {needsAction.length > 0 ? (
          <OrderList orders={needsAction} viewer="buyer" />
        ) : (
          <EmptyState icon={ShoppingBag} title="Nothing needs you right now" description="Orders awaiting payment or your review will show up here." />
        )}
      </section>

      {open.length > 0 || drafts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold">Your requirements</h2>
          <ul className="flex flex-col gap-2">
            {[...open, ...drafts].slice(0, 6).map((requirement) => (
              <li key={requirement.id}>
                <Link
                  href={requirement.status === "draft" ? `/dashboard/buyer/requirements/${requirement.id}/edit` : `/dashboard/buyer/requirements/${requirement.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-ink/25"
                >
                  <ClipboardList className="size-4 text-ink/50" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{requirement.title}</span>
                  {requirement.status === "draft" ? <Badge>Draft</Badge> : <Badge tone={requirement.offerCount > 0 ? "success" : "brand"}>{requirement.offerCount} offers</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
