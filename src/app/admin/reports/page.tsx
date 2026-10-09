import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { resolveContactMessageAction, reviewReportAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports & support" };

export default async function AdminReportsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [{ data: reports }, { data: contact }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, target_type, target_id, reason, details, created_at, reporter:profiles!reports_reporter_id_fkey(full_name, username)")
      .eq("status", "open")
      .order("created_at"),
    supabase.from("contact_messages").select("id, name, email, topic, message, created_at").eq("status", "open").order("created_at").limit(50),
  ]);

  // Resolve reported messages to their conversation for context.
  const messageIds = (reports ?? []).filter((report) => report.target_type === "message").map((report) => report.target_id);
  const { data: messages } = messageIds.length
    ? await supabase.from("messages").select("id, body, conversation_id, sender_id").in("id", messageIds)
    : { data: [] };

  return (
    <>
      <PageHeader title="Reports & support" description="Abuse reports from users and messages sent through the contact form." />
      <Card>
        <CardHeader>
          <CardTitle>Open abuse reports ({reports?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {(reports ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No open reports.</p> : null}
          {(reports ?? []).map((report) => {
            const message = messages?.find((m) => m.id === report.target_id);
            const targetHref =
              report.target_type === "user"
                ? `/admin/users/${report.target_id}`
                : report.target_type === "message" && message
                  ? `/dashboard/messages/${message.conversation_id}`
                  : report.target_type === "service"
                    ? `/admin/services`
                    : null;
            return (
              <div key={report.id} className="flex flex-col gap-2 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{report.reason.replace(/_/g, " ")}</Badge>
                  <Badge tone="outline" className="capitalize">
                    {report.target_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    by {report.reporter?.full_name} · {formatDateTime(report.created_at)}
                  </span>
                </div>
                {message?.body ? <p className="rounded-xl bg-mist/60 p-2">“{message.body}”</p> : null}
                {report.details ? <p className="text-ink-soft">{report.details}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {targetHref ? (
                    <Link href={targetHref} className="text-sm font-semibold text-brand-text hover:underline">
                      Open {report.target_type}
                    </Link>
                  ) : null}
                  {message?.sender_id ? (
                    <Link href={`/admin/users/${message.sender_id}`} className="text-sm font-semibold text-brand-text hover:underline">
                      View sender
                    </Link>
                  ) : null}
                  <ActionButton size="sm" variant="outline" action={reviewReportAction.bind(null, report.id, "reviewed")}>
                    Mark reviewed
                  </ActionButton>
                  <ActionButton size="sm" variant="ghost" action={reviewReportAction.bind(null, report.id, "dismissed")}>
                    Dismiss
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support messages ({contact?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {(contact ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No open support messages.</p> : null}
          {(contact ?? []).map((item) => (
            <div key={item.id} className="flex flex-col gap-1 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{item.name}</span>
                <a href={`mailto:${item.email}`} className="text-brand-text hover:underline">
                  {item.email}
                </a>
                <Badge tone="outline">{item.topic.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
              </div>
              <p className="whitespace-pre-line text-ink-soft">{item.message}</p>
              <ActionButton size="sm" variant="outline" className="self-start" action={resolveContactMessageAction.bind(null, item.id)}>
                Mark resolved
              </ActionButton>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
