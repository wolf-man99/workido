import "server-only";
import type { OrderStatus } from "@/lib/domain/orders/state-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ORDER_LIST_COLUMNS =
  "id, order_number, title, status, price_minor, total_minor, currency, delivery_deadline, created_at, updated_at, completed_at, buyer_id, specialist_id, source, service_id, buyer:profiles!orders_buyer_id_fkey(username, full_name, avatar_path), specialist:profiles!orders_specialist_id_fkey(username, full_name, avatar_path)";

export interface OrderListItem {
  id: string;
  order_number: string;
  title: string;
  status: OrderStatus;
  price_minor: number;
  total_minor: number | null;
  currency: string;
  delivery_deadline: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  buyer_id: string;
  specialist_id: string;
  source: string;
  service_id: string | null;
  buyer: { username: string; full_name: string; avatar_path: string | null } | null;
  specialist: { username: string; full_name: string; avatar_path: string | null } | null;
}

/** Orders where the user is on the given side, optionally filtered by status. */
export async function listOrders(userId: string, side: "buyer" | "specialist", statuses?: readonly OrderStatus[], limit = 50): Promise<OrderListItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select(ORDER_LIST_COLUMNS)
    .eq(side === "buyer" ? "buyer_id" : "specialist_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (statuses?.length) query = query.in("status", statuses as OrderStatus[]);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function countOrders(userId: string, side: "buyer" | "specialist", statuses: readonly OrderStatus[]): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq(side === "buyer" ? "buyer_id" : "specialist_id", userId)
    .in("status", statuses as OrderStatus[]);
  return count ?? 0;
}

export async function getOrderDetail(orderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "*, buyer:profiles!orders_buyer_id_fkey(id, username, full_name, avatar_path), specialist:profiles!orders_specialist_id_fkey(id, username, full_name, avatar_path)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const [events, submissions, deliverables, conversation, payments, refunds, disputes, reviews] = await Promise.all([
    supabase.from("order_events").select("id, event_type, actor_id, from_status, to_status, metadata, created_at").eq("order_id", orderId).order("id"),
    supabase.from("order_submissions").select("id, version, message, created_at").eq("order_id", orderId).order("version"),
    supabase
      .from("order_deliverables")
      .select("id, submission_id, kind, storage_path, external_url, filename, content_type, size_bytes, description, created_at")
      .eq("order_id", orderId)
      .order("created_at"),
    supabase.from("conversations").select("id").eq("order_id", orderId).maybeSingle(),
    supabase.from("payments").select("id, provider, status, amount_minor, currency, created_at, verified_at, failure_reason").eq("order_id", orderId).order("created_at"),
    supabase.from("refunds").select("id, status, amount_minor, currency, created_at, processed_at").eq("order_id", orderId).order("created_at"),
    supabase.from("disputes").select("id, reason, description, status, outcome, resolution, opened_by, created_at, resolved_at").eq("order_id", orderId).order("created_at"),
    supabase.from("reviews").select("id, reviewer_id, reviewee_id, rating, comment, created_at").eq("order_id", orderId),
  ]);

  return {
    order,
    events: events.data ?? [],
    submissions: submissions.data ?? [],
    deliverables: deliverables.data ?? [],
    conversationId: conversation.data?.id ?? null,
    payments: payments.data ?? [],
    refunds: refunds.data ?? [],
    disputes: disputes.data ?? [],
    reviews: reviews.data ?? [],
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
