import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { OrderListItem } from "@/lib/data/orders";
import { formatMoney } from "@/lib/domain/money";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, type OrderStatus } from "@/lib/domain/orders/state-machine";
import { formatDate, formatRelativeTime } from "@/lib/format";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function OrderList({ orders, viewer }: { orders: OrderListItem[]; viewer: "buyer" | "specialist" }) {
  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      {orders.map((order) => {
        const counterpart = viewer === "buyer" ? order.specialist : order.buyer;
        return (
          <li key={order.id}>
            <Link href={`/dashboard/orders/${order.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-mist/60 sm:gap-4">
              <Avatar name={counterpart?.full_name ?? "?"} path={counterpart?.avatar_path} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{order.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {viewer === "buyer" ? "with" : "for"} {counterpart?.full_name ?? "—"} · {order.order_number} · updated {formatRelativeTime(order.updated_at)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
              <div className="hidden flex-col items-end gap-1 sm:flex">
                <OrderStatusBadge status={order.status} />
                {order.delivery_deadline && !["completed", "cancelled", "refunded"].includes(order.status) ? (
                  <span className="text-xs text-muted-foreground">Due {formatDate(order.delivery_deadline)}</span>
                ) : null}
              </div>
              <span className="hidden font-display font-bold sm:block">{formatMoney(order.total_minor ?? order.price_minor, order.currency)}</span>
              <ChevronRight className="size-4 shrink-0 text-ink/40" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function StatCard({ label, value, href, hint }: { label: string; value: number | string; href?: string; hint?: string }) {
  const content = (
    <>
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className="font-display text-3xl font-bold text-ink">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </>
  );
  const className = "flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-5";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:border-ink/25`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
