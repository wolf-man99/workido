import "server-only";
import { getPublicEnv } from "@/lib/config/public-env";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { EMAIL_WORTHY_TYPES } from "./channels";
import { createEmailChannel } from "./email";

export interface DispatchSummary {
  mode: string;
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Delivers pending notification emails (outbox pattern). Run on a schedule
 * via /api/notifications/dispatch. Each notification is marked emailed_at
 * once handled (sent or intentionally skipped) so it is never sent twice.
 */
export async function dispatchNotificationEmails(limit = 50): Promise<DispatchSummary> {
  const db = createSupabaseServiceClient();
  const channel = createEmailChannel();
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const summary: DispatchSummary = { mode: channel.mode, examined: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: outbox, error } = await db.rpc("notification_email_outbox", { p_limit: limit });
  if (error) throw new Error(`Outbox query failed: ${error.message}`);

  for (const item of outbox ?? []) {
    summary.examined++;
    const shouldSend = channel.isEnabled() && item.email_enabled && EMAIL_WORTHY_TYPES.has(item.type);
    try {
      if (shouldSend) {
        await channel.send(
          { id: item.notification_id, type: item.type, title: item.title, body: item.body, linkUrl: item.link_path ? `${appUrl}${item.link_path}` : null },
          { userId: item.user_id, email: item.email, name: item.full_name },
        );
        summary.sent++;
      } else {
        summary.skipped++;
      }
      await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", item.notification_id);
    } catch {
      // Leave emailed_at empty so the next run retries.
      summary.failed++;
    }
  }
  return summary;
}
