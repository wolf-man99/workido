import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/orders/order-list";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain/orders/state-machine";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { escapeLikeForFilter } from "@/lib/validation/search";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  await requireAdmin();
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const status = ORDER_STATUSES.includes(params.status as OrderStatus) ? (params.status as OrderStatus) : undefined;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, title, status, total_minor, currency, payout_status, created_at, buyer:profiles!orders_buyer_id_fkey(full_name), specialist:profiles!orders_specialist_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    const term = escapeLikeForFilter(q);
    query = query.or(`order_number.ilike.%${term}%,title.ilike.%${term}%`);
  }
  if (status) query = query.eq("status", status);
  const { data: orders, error } = await query;
  if (error) throw new Error("Could not load orders");

  return (
    <>
      <PageHeader title="Orders" description="Search orders and inspect their full history." />
      <form method="get" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:flex-row">
        <Input name="q" type="search" defaultValue={q} placeholder="Order number or title" aria-label="Search orders" className="sm:flex-1" />
        <Select name="status" defaultValue={status ?? ""} aria-label="Status" className="sm:w-56">
          <option value="">Any status</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
      </form>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 font-semibold">Order</th>
              <th className="p-3 font-semibold">Parties</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Total</th>
              <th className="p-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(orders ?? []).map((order) => (
              <tr key={order.id} className="hover:bg-mist/50">
                <td className="p-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-semibold hover:underline">
                    {order.order_number}
                  </Link>
                  <span className="block max-w-xs truncate">{order.title}</span>
                </td>
                <td className="p-3 text-ink-soft">
                  {order.buyer?.full_name ?? "—"} → {order.specialist?.full_name ?? "—"}
                </td>
                <td className="p-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="p-3 font-semibold">{formatMoney(order.total_minor ?? 0, order.currency)}</td>
                <td className="p-3 text-ink-soft">{formatDate(order.created_at)}</td>
              </tr>
            ))}
            {(orders ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
