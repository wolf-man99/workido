import type { Metadata } from "next";
import { z } from "zod";
import { StatCard } from "@/components/orders/order-list";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

const count = z.coerce.number().int().nonnegative();
const metricsSchema = z.object({
  total_users: count,
  buyers: count,
  specialists: count,
  published_specialists: count,
  suspended_users: count,
  open_requirements: count,
  published_services: count,
  active_orders: count,
  awaiting_payment_orders: count,
  completed_orders: count,
  disputed_orders: count,
  pending_refunds: count,
  pending_payouts: count,
  pending_verifications: count,
  open_reports: count,
  gtv_by_currency: z.record(z.string(), z.coerce.number()),
  platform_revenue_by_currency: z.record(z.string(), z.coerce.number()),
});

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_platform_metrics");
  const parsed = metricsSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("Could not load platform metrics");
  const m = parsed.data;
  const gtv = Object.entries(m.gtv_by_currency);
  const revenue = Object.entries(m.platform_revenue_by_currency);

  return (
    <>
      <PageHeader title="Platform health" description="Live figures calculated from the database. Nothing here is estimated." />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Needs attention</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Pending verifications" value={m.pending_verifications} href="/admin/verification" />
          <StatCard label="Disputed orders" value={m.disputed_orders} href="/admin/disputes" />
          <StatCard label="Pending refunds" value={m.pending_refunds} href="/admin/payments" />
          <StatCard label="Pending payouts" value={m.pending_payouts} href="/admin/payments" />
          <StatCard label="Open reports" value={m.open_reports} href="/admin/reports" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Marketplace</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Registered users" value={m.total_users} href="/admin/users" hint={`${m.suspended_users} suspended`} />
          <StatCard label="Buyers" value={m.buyers} />
          <StatCard label="Specialists" value={m.specialists} hint={`${m.published_specialists} published`} />
          <StatCard label="Published services" value={m.published_services} href="/admin/services" />
          <StatCard label="Open requirements" value={m.open_requirements} />
          <StatCard label="Active orders" value={m.active_orders} href="/admin/orders" hint={`${m.awaiting_payment_orders} awaiting payment`} />
          <StatCard label="Completed orders" value={m.completed_orders} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-5">
          <span className="text-sm font-semibold text-ink-soft">Gross transaction value</span>
          <span className="font-display text-3xl font-bold">{gtv.length ? gtv.map(([currency, total]) => formatMoney(Number(total), currency)).join(" · ") : formatMoney(0)}</span>
          <span className="text-xs text-muted-foreground">Total paid by buyers on orders with verified payment, excluding refunded or refunding orders. This is not platform revenue.</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-5">
          <span className="text-sm font-semibold text-ink-soft">Platform revenue (fees)</span>
          <span className="font-display text-3xl font-bold">{revenue.length ? revenue.map(([currency, total]) => formatMoney(Number(total), currency)).join(" · ") : formatMoney(0)}</span>
          <span className="text-xs text-muted-foreground">Buyer and specialist fees on completed orders. Fees are currently configured at 0%.</span>
        </div>
      </section>
    </>
  );
}
