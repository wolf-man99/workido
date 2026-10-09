import type { Metadata } from "next";
import { OrdersPage } from "@/components/orders/orders-page";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orders" };

export default async function BuyerOrdersPage(props: PageProps<"/dashboard/buyer/orders">) {
  const user = await requireUser("/dashboard/buyer/orders");
  const { tab } = await props.searchParams;
  return <OrdersPage userId={user.id} side="buyer" tab={typeof tab === "string" ? tab : undefined} />;
}
