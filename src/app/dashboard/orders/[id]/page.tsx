import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { Alert } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage(props: PageProps<"/dashboard/orders/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/orders/${id}`);
  const searchParams = await props.searchParams;
  // RLS returns nothing unless the user is a participant (or an admin).
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const viewer = detail.order.buyer_id === user.id ? "buyer" : detail.order.specialist_id === user.id ? "specialist" : null;
  if (!viewer) notFound();

  return (
    <>
      <Link href={viewer === "buyer" ? "/dashboard/buyer/orders" : "/dashboard/specialist/orders"} className="text-sm font-semibold text-brand-text hover:underline">
        ← All orders
      </Link>
      {searchParams.paid === "1" && detail.order.status === "paid" ? (
        <Alert tone="success" title="Payment verified">
          We&apos;ve notified the specialist. Work starts as soon as they accept.
        </Alert>
      ) : null}
      <OrderDetailView detail={detail} viewer={viewer} viewerId={user.id} />
    </>
  );
}
