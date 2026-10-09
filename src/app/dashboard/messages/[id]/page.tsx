import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/messages/chat-thread";
import { OrderStatusBadge } from "@/components/orders/order-list";
import { Avatar } from "@/components/ui/avatar";
import { requireUser } from "@/lib/auth/session";
import type { OrderStatus } from "@/lib/domain/orders/state-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage(props: PageProps<"/dashboard/messages/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/messages/${id}`);
  const supabase = await createSupabaseServerClient();

  // RLS: only participants (or admins) can read the conversation.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, order_id, orders(id, title, order_number, status, buyer_id, specialist_id)")
    .eq("id", id)
    .maybeSingle();
  if (!conversation?.orders) notFound();
  const order = conversation.orders;
  const isParticipant = user.id === order.buyer_id || user.id === order.specialist_id;
  if (!isParticipant && !user.isAdmin) notFound();

  const [{ data: messages }, { data: people }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, message_type, body, attachment_path, attachment_name, attachment_size, created_at")
      .eq("conversation_id", id)
      .order("created_at")
      .limit(500),
    supabase.from("profiles").select("id, full_name, avatar_path").in("id", [order.buyer_id, order.specialist_id]),
  ]);
  const names = Object.fromEntries((people ?? []).map((person) => [person.id, person.full_name]));
  const counterpartId = user.id === order.buyer_id ? order.specialist_id : order.buyer_id;
  const counterpart = (people ?? []).find((person) => person.id === counterpartId);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={counterpart?.full_name ?? "?"} path={counterpart?.avatar_path} />
          <div>
            <h1 className="font-display text-xl font-bold">{isParticipant ? counterpart?.full_name : `${names[order.buyer_id]} ↔ ${names[order.specialist_id]}`}</h1>
            <Link href={isParticipant ? `/dashboard/orders/${order.id}` : `/admin/orders/${order.id}`} className="text-sm text-brand-text hover:underline">
              {order.title} · {order.order_number}
            </Link>
          </div>
        </div>
        <OrderStatusBadge status={order.status as OrderStatus} />
      </div>
      <ChatThread
        conversationId={id}
        orderId={order.id}
        currentUserId={user.id}
        names={names}
        initialMessages={messages ?? []}
        canSend={isParticipant && user.accountStatus === "active"}
      />
    </>
  );
}
