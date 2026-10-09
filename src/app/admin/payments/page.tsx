import type { Metadata } from "next";
import Link from "next/link";
import { PayoutForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { processRefundAction } from "@/lib/actions/payments";
import { requireAdmin } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/format";
import { getPaymentConfig } from "@/lib/payments/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Refunds & payouts" };

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [{ data: refunds }, { data: payouts }, { data: webhooks }] = await Promise.all([
    supabase
      .from("refunds")
      .select("id, status, amount_minor, currency, reason, created_at, failure_reason, orders(id, order_number, title)")
      .in("status", ["pending", "processing", "failed"])
      .order("created_at"),
    supabase
      .from("orders")
      .select("id, order_number, title, price_minor, specialist_fee_minor, currency, completed_at, specialist:profiles!orders_specialist_id_fkey(full_name)")
      .eq("payout_status", "pending")
      .order("completed_at"),
    supabase.from("payment_webhook_events").select("id, provider, event_type, processing_status, error, received_at").order("received_at", { ascending: false }).limit(20),
  ]);
  const config = getPaymentConfig();

  return (
    <>
      <PageHeader title="Refunds & payouts" description="Refunds are executed through the payment provider. Payouts are settled outside Workido and recorded here." />
      <Alert tone={config.configured ? "info" : "warning"}>
        {config.configured
          ? `Payment provider: ${config.provider.id === "dev" ? "development adapter (test mode, no real money)" : config.provider.id}.`
          : `Payments not configured: ${config.reason}`}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Refunds awaiting action ({refunds?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {(refunds ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No pending refunds.</p> : null}
          {(refunds ?? []).map((refund) => (
            <div key={refund.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/orders/${refund.orders?.id ?? ""}`} className="font-semibold hover:underline">
                  {refund.orders?.order_number} · {refund.orders?.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(refund.created_at)} · {refund.reason}
                  {refund.failure_reason ? ` · last error: ${refund.failure_reason}` : ""}
                </p>
              </div>
              <span className="font-semibold">{formatMoney(refund.amount_minor, refund.currency)}</span>
              <Badge tone={refund.status === "failed" ? "danger" : "warning"} className="capitalize">
                {refund.status}
              </Badge>
              {refund.status !== "processing" ? (
                <ActionButton
                  size="sm"
                  action={processRefundAction.bind(null, refund.id)}
                  confirm={{ title: "Process this refund?", description: "The refund is sent to the payment provider.", confirmLabel: "Process refund" }}
                >
                  Process
                </ActionButton>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending specialist payouts ({payouts?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {(payouts ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No pending payouts.</p> : null}
          {(payouts ?? []).map((order) => (
            <div key={order.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/orders/${order.id}`} className="font-semibold hover:underline">
                  {order.order_number} · {order.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {order.specialist?.full_name} · completed {formatDateTime(order.completed_at)}
                </p>
              </div>
              <span className="font-semibold">{formatMoney(order.price_minor - order.specialist_fee_minor, order.currency)}</span>
              <PayoutForm orderId={order.id} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent webhook events</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(webhooks ?? []).length === 0 ? <p className="text-muted-foreground">No webhook events received yet.</p> : null}
          {(webhooks ?? []).map((event) => (
            <p key={event.id} className="flex flex-wrap gap-2">
              <span className="text-muted-foreground">{formatDateTime(event.received_at)}</span>
              <span className="font-mono text-xs">
                {event.provider}:{event.event_type}
              </span>
              <Badge tone={event.processing_status === "processed" ? "success" : event.processing_status === "failed" ? "danger" : "neutral"}>{event.processing_status}</Badge>
              {event.error ? <span className="text-xs text-danger">{event.error}</span> : null}
            </p>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
