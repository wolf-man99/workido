import "server-only";
import { getServerEnv } from "@/lib/config/server-env";
import type { NotificationChannel, OutboundNotification, Recipient } from "./channels";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function renderNotificationEmail(notification: OutboundNotification, recipient: Recipient) {
  const firstName = recipient.name.split(" ")[0] ?? "there";
  const text = [
    `Hi ${firstName},`,
    "",
    notification.title,
    notification.body ?? "",
    "",
    notification.linkUrl ? `Open Workido: ${notification.linkUrl}` : "",
    "",
    "You can change email preferences in Account settings.",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#FFFDF8;color:#171717;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E4E2DC;border-radius:16px;padding:24px">
<p style="font-weight:700;font-size:20px;margin:0 0 16px">workido<span style="color:#FF6B35">.</span></p>
<p>Hi ${escapeHtml(firstName)},</p>
<p style="font-weight:600;font-size:16px">${escapeHtml(notification.title)}</p>
${notification.body ? `<p>${escapeHtml(notification.body)}</p>` : ""}
${notification.linkUrl ? `<p><a href="${escapeHtml(notification.linkUrl)}" style="display:inline-block;background:#FF6B35;color:#171717;font-weight:600;padding:10px 18px;border-radius:999px;text-decoration:none">Open Workido</a></p>` : ""}
<p style="font-size:12px;color:#5C5F66;margin-top:24px">You can change email preferences in Account settings.</p>
</div></body></html>`;
  return { subject: notification.title, text, html };
}

/** Email via Resend's REST API when RESEND_API_KEY + EMAIL_FROM are set. */
export function createEmailChannel(fetchImpl: typeof fetch = fetch): NotificationChannel & { mode: "resend" | "log" | "disabled" } {
  const env = getServerEnv();
  const configured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
  // Without a provider, development logs emails; production skips them.
  const mode = configured ? "resend" : env.NODE_ENV === "production" ? "disabled" : "log";

  return {
    id: "email",
    mode,
    isEnabled: () => mode !== "disabled",
    async send(notification, recipient) {
      const message = renderNotificationEmail(notification, recipient);
      if (mode === "log") {
        // Development only: show that an email would be sent, without its address.
        console.info(`[email:dev] to user ${recipient.userId}: ${message.subject}`);
        return;
      }
      if (mode === "disabled") return;
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [recipient.email], subject: message.subject, text: message.text, html: message.html }),
      });
      if (!response.ok) throw new Error(`Email provider responded ${response.status}`);
    },
  };
}
