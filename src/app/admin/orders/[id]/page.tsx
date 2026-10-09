import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DisputeResolver, PayoutForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/forms/action-button";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { processRefundAction } from "@/lib/actions/payments";
import { requireAdmin } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/data/orders";
import { formatMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const openDispute = detail.disputes.find((dispute) => dispute.status === "open");
  const pendingRefunds = detail.refunds.filter((refund) => refund.status === "pending" || refund.status === "failed");

  return (
    <>
      <Link href="/admin/orders" className="text-sm font-semibold text-brand-text hover:underline">
        ← All orders
      </Link>
      {openDispute || pendingRefunds.length > 0 || detail.order.payout_status === "pending" ? (
        <Card className="border-ink/20">
          <CardHeader>
            <CardTitle>Admin actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {openDispute ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Resolve dispute</p>
                <DisputeResolver disputeId={openDispute.id} />
              </div>
            ) : null}
            {pendingRefunds.map((refund) => (
              <div key={refund.id} className="flex flex-wrap items-center gap-3">
                <p className="text-sm">
                  Refund of <span className="font-semibold">{formatMoney(refund.amount_minor, refund.currency)}</span> is {refund.status}.
                </p>
                <ActionButton
                  size="sm"
                  action={processRefundAction.bind(null, refund.id)}
                  confirm={{ title: "Send refund to the payment provider?", description: "The buyer is refunded to their original payment method. The order is marked refunded once the provider confirms.", confirmLabel: "Process refund" }}
                >
                  Process refund
                </ActionButton>
              </div>
            ))}
            {detail.order.payout_status === "pending" ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm">
                  Specialist payout of <span className="font-semibold">{formatMoney(detail.order.price_minor - detail.order.specialist_fee_minor, detail.order.currency)}</span> is pending manual
                  settlement.
                </p>
                <PayoutForm orderId={detail.order.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <OrderDetailView detail={detail} viewer="admin" viewerId={admin.id} />
    </>
  );
}
