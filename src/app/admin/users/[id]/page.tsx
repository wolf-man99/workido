import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReasonAction } from "@/components/admin/admin-forms";
import { OrderStatusBadge } from "@/components/orders/order-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { setAccountStatusAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage(props: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();

  const [{ data: found }, { data: specialist }, { data: orders }, { data: actions }, { data: reports }] = await Promise.all([
    supabase.rpc("admin_search_users", { p_query: profile.username, p_limit: 5 }),
    supabase.from("specialist_profiles").select("is_published, verification_status, availability_status, rating_avg, rating_count, completed_orders_count").eq("user_id", id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, title, status, total_minor, currency, buyer_id, created_at")
      .or(`buyer_id.eq.${id},specialist_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("admin_actions").select("id, action, reason, created_at").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("reports").select("id, reason, details, status, created_at").eq("target_id", id).order("created_at", { ascending: false }),
  ]);
  const account = found?.find((user) => user.id === id);
  const isSelf = admin.id === id;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/users" className="hover:underline">
            Users
          </Link>
        }
        title={profile.full_name}
        description={`@${profile.username} · joined ${formatDate(profile.created_at)}`}
        actions={
          isSelf ? null : profile.account_status === "active" ? (
            <ReasonAction
              variant="danger"
              label="Suspend account"
              title="Suspend this account?"
              description="They won't be able to post, order, offer or message. Their public profile is hidden. The reason is recorded in the audit log."
              confirmLabel="Suspend"
              tone="danger"
              action={setAccountStatusAction.bind(null, id, "suspended")}
            />
          ) : (
            <ReasonAction
              label="Reactivate account"
              title="Reactivate this account?"
              description="Restores normal access. The reason is recorded in the audit log."
              confirmLabel="Reactivate"
              action={setAccountStatusAction.bind(null, id, "active")}
            />
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={profile.full_name} path={profile.avatar_path} size="lg" />
              <div className="flex flex-col gap-1">
                <span>{account?.email}</span>
                <div className="flex flex-wrap gap-1">
                  {account?.roles.map((role) => (
                    <Badge key={role} tone={role === "admin" ? "dark" : "neutral"} className="capitalize">
                      {role}
                    </Badge>
                  ))}
                  <Badge tone={profile.account_status === "active" ? "success" : "danger"} className="capitalize">
                    {profile.account_status}
                  </Badge>
                  {profile.is_sample ? <Badge tone="outline">Sample data</Badge> : null}
                </div>
              </div>
            </div>
            {specialist ? (
              <p className="text-ink-soft">
                Specialist profile: {specialist.is_published ? "published" : "not published"} · verification {specialist.verification_status.replace("_", " ")} ·{" "}
                {specialist.availability_status} · {specialist.completed_orders_count} completed orders
                {specialist.rating_count ? ` · ${Number(specialist.rating_avg).toFixed(1)}★ (${specialist.rating_count})` : ""}
              </p>
            ) : null}
            {specialist?.is_published ? (
              <Link href={`/specialists/${profile.username}`} className="font-semibold text-brand-text hover:underline">
                View public profile
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moderation history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {(actions ?? []).length === 0 ? <p className="text-muted-foreground">No admin actions.</p> : null}
            {(actions ?? []).map((action) => (
              <div key={action.id} className="flex flex-col">
                <span className="font-semibold">{action.action.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(action.created_at)}
                  {action.reason ? ` — ${action.reason}` : ""}
                </span>
              </div>
            ))}
            {(reports ?? []).length > 0 ? (
              <div className="mt-2 border-t border-border pt-2">
                <p className="font-semibold">Reports about this user ({reports?.length})</p>
                {(reports ?? []).map((report) => (
                  <p key={report.id} className="text-xs text-muted-foreground">
                    {formatDate(report.created_at)} · {report.reason.replace(/_/g, " ")} · {report.status}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          {(orders ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(orders ?? []).map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs hover:underline">
                    {order.order_number}
                  </Link>
                  <span className="min-w-0 flex-1 truncate">{order.title}</span>
                  <Badge tone="outline">{order.buyer_id === id ? "Buyer" : "Specialist"}</Badge>
                  <OrderStatusBadge status={order.status} />
                  <span className="font-semibold">{formatMoney(order.total_minor ?? 0, order.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
