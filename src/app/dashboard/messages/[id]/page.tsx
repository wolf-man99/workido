import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderNowPanel } from "@/components/forms/order-forms";
import { ChatThread } from "@/components/messages/chat-thread";
import { OrderStatusBadge } from "@/components/orders/order-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import type { OrderStatus } from "@/lib/domain/orders/state-machine";
import { formatDeliveryTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversation" };

const MESSAGE_COLUMNS = "id, sender_id, message_type, body, attachment_path, attachment_name, attachment_size, created_at";

export default async function ConversationPage(props: PageProps<"/dashboard/messages/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/messages/${id}`);
  const supabase = await createSupabaseServerClient();

  // RLS: only participants (or admins) can read the conversation.
  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      "id, kind, buyer_id, specialist_id, orders(id, title, order_number, status, buyer_id, specialist_id), services(id, title, slug, price_minor, currency, delivery_time_hours, included_revisions, buyer_instructions, publication_status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  // Order conversations: the two parties come from the order.
  const order = conversation.orders;
  const buyerId = order?.buyer_id ?? conversation.buyer_id;
  const specialistId = order?.specialist_id ?? conversation.specialist_id;
  if (!buyerId || !specialistId) notFound();
  const isParticipant = user.id === buyerId || user.id === specialistId;
  if (!isParticipant && !user.isAdmin) notFound();
  const isBuyer = user.id === buyerId;

  const [{ data: messages }, { data: people }, { data: ordersTogether }] = await Promise.all([
    supabase.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at").limit(500),
    supabase.from("profiles").select("id, full_name, username, avatar_path").in("id", [buyerId, specialistId]),
    order
      ? Promise.resolve({ data: [] })
      : supabase
          .from("orders")
          .select("id, title, order_number, status")
          .eq("buyer_id", buyerId)
          .eq("specialist_id", specialistId)
          .order("created_at", { ascending: false })
          .limit(5),
  ]);
  const names = Object.fromEntries((people ?? []).map((person) => [person.id, person.full_name]));
  const counterpartId = isBuyer ? specialistId : buyerId;
  const counterpart = (people ?? []).find((person) => person.id === counterpartId);
  const specialistProfile = (people ?? []).find((person) => person.id === specialistId);
  const title = isParticipant ? (counterpart?.full_name ?? "Deleted user") : `${names[buyerId] ?? "Buyer"} ↔ ${names[specialistId] ?? "Specialist"}`;
  const canSend = isParticipant && user.accountStatus === "active";

  if (order) {
    return (
      <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={counterpart?.full_name ?? "?"} path={counterpart?.avatar_path} />
            <div>
              <h1 className="font-display text-xl font-bold">{title}</h1>
              <Link href={isParticipant ? `/dashboard/orders/${order.id}` : `/admin/orders/${order.id}`} className="text-sm text-brand-text hover:underline">
                {order.title} · {order.order_number}
              </Link>
            </div>
          </div>
          <OrderStatusBadge status={order.status as OrderStatus} />
        </div>
        <ChatThread conversationId={id} orderId={order.id} currentUserId={user.id} names={names} initialMessages={messages ?? []} canSend={canSend} />
      </>
    );
  }

  // Pre-order enquiry.
  const service = conversation.services;
  const canOrder = isBuyer && service?.publication_status === "published";
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={counterpart?.full_name ?? "?"} path={counterpart?.avatar_path} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold">{title}</h1>
          {isBuyer && specialistProfile ? (
            <Link href={`/specialists/${specialistProfile.username}`} className="text-sm text-brand-text hover:underline">
              View profile
            </Link>
          ) : null}
        </div>
        <Badge tone="warning">Before ordering</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ChatThread
          conversationId={id}
          orderId={null}
          currentUserId={user.id}
          names={names}
          initialMessages={messages ?? []}
          canSend={canSend}
          emptyText={
            isBuyer
              ? "Say hello and ask anything about the work. You only pay when you place an order."
              : "No messages yet."
          }
        />

        <aside className="order-first flex flex-col gap-4 lg:order-last">
          {service ? (
            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isBuyer ? "Asking about" : "About your gig"}</p>
                <CardTitle className="text-lg">
                  <Link href={`/gigs/${service.slug}`} className="hover:underline">
                    {service.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-ink-soft">
                  <span className="font-display text-2xl font-bold text-ink">{formatMoney(service.price_minor, service.currency)}</span>
                  {" · "}
                  {formatDeliveryTime(service.delivery_time_hours)} · {service.included_revisions} revision{service.included_revisions === 1 ? "" : "s"}
                </p>
                {canOrder ? (
                  <>
                    <OrderNowPanel serviceId={service.id} instructions={service.buyer_instructions} label="Order this gig" />
                    <p className="text-xs text-muted-foreground">You&apos;ll review the total and pay securely on Workido.</p>
                  </>
                ) : isBuyer ? (
                  <p className="text-sm text-muted-foreground">This gig isn&apos;t available to order right now.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Answer their questions here. They can order this gig straight from the chat.</p>
                )}
              </CardContent>
            </Card>
          ) : isBuyer && specialistProfile ? (
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6 text-sm">
                <p>Ready to hire? Order one of their gigs, or post a task and invite them.</p>
                <Link href={`/specialists/${specialistProfile.username}`} className="font-semibold text-brand-text hover:underline">
                  See their gigs
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {ordersTogether && ordersTogether.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orders together</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {ordersTogether.map((item) => (
                    <li key={item.id} className="flex flex-col gap-1">
                      <Link href={isParticipant ? `/dashboard/orders/${item.id}` : `/admin/orders/${item.id}`} className="text-sm font-semibold hover:underline">
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.order_number} <OrderStatusBadge status={item.status as OrderStatus} />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
