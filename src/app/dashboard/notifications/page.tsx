import { Bell, CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { markNotificationsReadAction } from "@/lib/actions/notifications";
import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/lib/data/notifications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser("/dashboard/notifications");
  const notifications = await listNotifications(100);
  const unread = notifications.filter((notification) => !notification.read_at);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about your orders, offers and messages."
        actions={
          unread.length > 0 ? (
            <ActionButton variant="outline" action={markNotificationsReadAction.bind(null, undefined)}>
              <CheckCheck aria-hidden /> Mark all as read
            </ActionButton>
          ) : null
        }
      />
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="We'll let you know when something needs your attention." />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          {notifications.map((notification) => {
            const content = (
              <div className="flex items-start gap-3 p-4">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.read_at ? "bg-transparent" : "bg-brand")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", notification.read_at ? "font-medium text-ink-soft" : "font-bold text-ink")}>{notification.title}</p>
                  {notification.body ? <p className="line-clamp-2 text-sm text-muted-foreground">{notification.body}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(notification.created_at)}</span>
                {!notification.read_at ? <span className="sr-only">(unread)</span> : null}
              </div>
            );
            return (
              <li key={notification.id}>
                {notification.link_path ? (
                  <Link href={notification.link_path} className="block hover:bg-mist/60">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
