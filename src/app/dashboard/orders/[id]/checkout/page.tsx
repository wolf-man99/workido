import { FlaskConical, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutPanel } from "@/components/orders/checkout-panel";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/data/orders";
import { formatMoney } from "@/lib/domain/money";
import { formatDeliveryTime } from "@/lib/format";
import { getPaymentConfig } from "@/lib/payments/provider";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage(props: PageProps<"/dashboard/orders/[id]/checkout">) {
  const { id } = await props.params;
  const user = await requireActiveUser(`/dashboard/orders/${id}/checkout`);
  const detail = await getOrderDetail(id);
  if (!detail || detail.order.buyer_id !== user.id) notFound();
  const { order, payments } = detail;
  if (order.status !== "pending_payment") redirect(`/dashboard/orders/${order.id}`);

  const config = getPaymentConfig();
  const lastFailure = [...payments].reverse().find((payment) => payment.status === "failed");
  const scope = order.scope_snapshot as { deliverables?: string | null; description?: string | null };

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/dashboard/orders/${order.id}`} className="hover:underline">
            Order {order.order_number}
          </Link>
        }
        title="Review & pay"
        description="Check the agreed scope and total before paying."
      />

      {config.configured && !config.provider.isLive ? (
        <Alert tone="warning" title="Test mode">
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="size-4" aria-hidden /> Payments here are simulated with the development adapter. No real money moves.
          </span>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{order.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={order.specialist?.full_name ?? "Specialist"} path={order.specialist?.avatar_path} />
              <div>
                <p className="font-semibold">{order.specialist?.full_name}</p>
                <p className="text-xs text-muted-foreground">Your specialist</p>
              </div>
            </div>
            {scope.deliverables ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</p>
                <p className="whitespace-pre-line text-sm">{scope.deliverables}</p>
              </div>
            ) : null}
            <ul className="flex flex-col gap-1 text-sm text-ink-soft">
              <li>Delivery within {formatDeliveryTime(order.delivery_time_hours)} after the specialist accepts</li>
              <li>{order.revisions_included} revision round{order.revisions_included === 1 ? "" : "s"} included</li>
            </ul>
            {order.buyer_brief ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your brief</p>
                <p className="whitespace-pre-line text-sm">{order.buyer_brief}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <dt>Gig price</dt>
                  <dd>{formatMoney(order.price_minor, order.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Service fee</dt>
                  <dd>{order.buyer_fee_minor > 0 ? formatMoney(order.buyer_fee_minor, order.currency) : "None"}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold">
                  <dt>Total</dt>
                  <dd>{formatMoney(order.total_minor ?? order.price_minor, order.currency)}</dd>
                </div>
              </dl>
              {lastFailure ? <Alert tone="warning">Your last attempt failed{lastFailure.failure_reason ? `: ${lastFailure.failure_reason}` : ""}. You can try again.</Alert> : null}
              {config.configured ? (
                <CheckoutPanel orderId={order.id} totalMinor={order.total_minor ?? order.price_minor} currency={order.currency} title={order.title} />
              ) : (
                <Alert tone="info" title="Payments aren't available yet">
                  Online payments haven&apos;t been configured for this environment. Your order is saved — come back once payments are enabled.
                </Alert>
              )}
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                Payments are processed by our payment provider. Workido never sees or stores your card details. If the specialist declines or a
                dispute is resolved in your favour, you&apos;re refunded through the same provider.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
