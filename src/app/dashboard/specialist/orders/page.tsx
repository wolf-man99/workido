import type { Metadata } from "next";
import { OrdersPage } from "@/components/orders/orders-page";
import { requireSpecialist } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orders" };

export default async function SpecialistOrdersPage(props: PageProps<"/dashboard/specialist/orders">) {
  const user = await requireSpecialist();
  const { tab } = await props.searchParams;
  return <OrdersPage userId={user.id} side="specialist" tab={typeof tab === "string" ? tab : undefined} />;
}
