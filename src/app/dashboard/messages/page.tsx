import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { formatRelativeTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser("/dashboard/messages");
  const supabase = await createSupabaseServerClient();
  const { data: conversations } = await supabase.rpc("list_my_conversations");

  return (
    <>
      <PageHeader title="Messages" description="Talk to specialists before you order, and keep each order's conversation in one place." />
      {!conversations || conversations.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No conversations yet" description="Contact a specialist from any gig or profile to ask questions before ordering. Each order also gets its own chat." />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          {conversations.map((conversation) => {
            const unread = Number(conversation.unread_count) > 0;
            const preview =
              conversation.last_message_type === "file"
                ? "📎 Attachment"
                : (conversation.last_message_body ?? "No messages yet");
            return (
              <li key={conversation.conversation_id}>
                <Link href={`/dashboard/messages/${conversation.conversation_id}`} className="flex items-center gap-3 p-4 hover:bg-mist/60">
                  <Avatar name={conversation.counterpart_name} path={conversation.counterpart_avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate", unread ? "font-bold" : "font-semibold")}>{conversation.counterpart_name}</p>
                      {conversation.last_message_at ? <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(conversation.last_message_at)}</span> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {conversation.kind === "enquiry" ? `Before ordering${conversation.service_title ? ` · ${conversation.service_title}` : ""}` : conversation.order_title}
                    </p>
                    <p className={cn("truncate text-sm", unread ? "font-semibold text-ink" : "text-ink-soft")}>
                      {conversation.last_sender_id === user.id ? "You: " : ""}
                      {preview}
                    </p>
                  </div>
                  {unread ? (
                    <span className="flex min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-ink" aria-label={`${conversation.unread_count} unread`}>
                      {conversation.unread_count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
