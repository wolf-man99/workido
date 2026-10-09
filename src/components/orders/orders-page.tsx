import { Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { listOrders } from "@/lib/data/orders";
import { ACTIVE_STATUSES, TERMINAL_STATUSES, type OrderStatus } from "@/lib/domain/orders/state-machine";
import { cn } from "@/lib/utils";
import { OrderList } from "./order-list";

const TABS = [
  { key: "active", label: "Active", statuses: [...ACTIVE_STATUSES, "pending_payment", "refund_pending"] as OrderStatus[] },
  { key: "completed", label: "Completed", statuses: ["completed"] as OrderStatus[] },
  { key: "closed", label: "Cancelled & refunded", statuses: TERMINAL_STATUSES.filter((s) => s !== "completed") },
] as const;

/** Order list with tabs, shared by the buyer and specialist dashboards. */
export async function OrdersPage({ userId, side, tab }: { userId: string; side: "buyer" | "specialist"; tab: string | undefined }) {
  const current = TABS.find((item) => item.key === tab) ?? TABS[0];
  const orders = await listOrders(userId, side, current.statuses, 100);
  const base = side === "buyer" ? "/dashboard/buyer/orders" : "/dashboard/specialist/orders";

  return (
    <>
      <PageHeader eyebrow={side === "buyer" ? "Hiring" : "Selling"} title="Orders" description={side === "buyer" ? "Everything you've bought." : "Work you've been hired for."} />
      <nav aria-label="Order filters" className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "active" ? base : `${base}?tab=${item.key}`}
            aria-current={item.key === current.key ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold",
              item.key === current.key ? "bg-ink text-cream" : "bg-card text-ink-soft ring-1 ring-border hover:ring-ink/30",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {orders.length > 0 ? (
        <OrderList orders={orders} viewer={side} />
      ) : (
        <EmptyState
          icon={Package}
          title={current.key === "active" ? "No active orders" : current.key === "completed" ? "No completed orders yet" : "Nothing here"}
          description={side === "buyer" ? "Buy a gig or accept an offer to start an order." : "Paid orders and accepted offers appear here."}
          action={
            side === "buyer" ? (
              <Button asChild variant="outline">
                <Link href="/gigs">Browse gigs</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/dashboard/specialist/opportunities">See opportunities</Link>
              </Button>
            )
          }
        />
      )}
    </>
  );
}
