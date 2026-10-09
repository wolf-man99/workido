import { Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DisputeResolver } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { privateFileHref } from "@/lib/storage/server";

export const metadata: Metadata = { title: "Disputes" };

export default async function AdminDisputesPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: disputes } = await supabase
    .from("disputes")
    .select(
      "id, reason, description, status, created_at, opened_by, dispute_attachments(id, filename, storage_path), orders(id, order_number, title, total_minor, currency, buyer_id, buyer:profiles!orders_buyer_id_fkey(full_name), specialist:profiles!orders_specialist_id_fkey(full_name))",
    )
    .eq("status", "open")
    .order("created_at");

  return (
    <>
      <PageHeader title="Open disputes" description="Review the order history, messages and deliverables before deciding. Decisions are recorded and shared with both parties." />
      {(disputes ?? []).length === 0 ? (
        <EmptyState icon={Scale} title="No open disputes" />
      ) : (
        <ul className="flex flex-col gap-4">
          {(disputes ?? []).map((dispute) => {
            const order = dispute.orders;
            return (
              <li key={dispute.id} className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">{dispute.reason.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground">Opened {formatDateTime(dispute.created_at)}</span>
                  </div>
                  {order ? (
                    <Link href={`/admin/orders/${order.id}`} className="font-semibold hover:underline">
                      {order.order_number} · {order.title}
                    </Link>
                  ) : null}
                  {order ? (
                    <p className="text-sm text-muted-foreground">
                      {order.buyer?.full_name} → {order.specialist?.full_name} · {formatMoney(order.total_minor ?? 0, order.currency)} · opened by{" "}
                      {dispute.opened_by === order.buyer_id ? "buyer" : "specialist"}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-line rounded-2xl bg-mist/60 p-3 text-sm">{dispute.description}</p>
                  {dispute.dispute_attachments.length > 0 ? (
                    <ul className="flex flex-col gap-1 text-sm">
                      {dispute.dispute_attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <a href={privateFileHref("order-files", attachment.storage_path, attachment.filename)} className="font-medium hover:underline">
                            📎 {attachment.filename}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <DisputeResolver disputeId={dispute.id} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
