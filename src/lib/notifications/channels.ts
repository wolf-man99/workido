/**
 * Notification channels.
 *
 *  - In-app: always on. Rows in public.notifications are created by database
 *    triggers when orders, offers, invitations, messages and reviews change,
 *    so they can't be forged or skipped by application code.
 *  - Email: the dispatcher (src/lib/notifications/dispatcher.ts) reads the
 *    notification outbox and delivers emails through an EmailProvider.
 *  - WhatsApp: integration point only. Core flows never depend on it.
 */

export interface OutboundNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
}

export interface Recipient {
  userId: string;
  email: string;
  name: string;
}

export interface NotificationChannel {
  id: "email" | "whatsapp";
  isEnabled(): boolean;
  send(notification: OutboundNotification, recipient: Recipient): Promise<void>;
}

/** Notification types important enough to email (others stay in-app only). */
export const EMAIL_WORTHY_TYPES = new Set([
  "order_paid",
  "order_accepted",
  "work_submitted",
  "revision_requested",
  "order_completed",
  "order_cancelled",
  "refund_pending",
  "refund_processed",
  "offer_received",
  "offer_accepted",
  "invitation_received",
  "message_received",
  "dispute_opened",
  "verification_approved",
  "verification_rejected",
  "service_removed",
]);

/**
 * WhatsApp is intentionally not connected in the MVP. Implement `send` with
 * the WhatsApp Business Platform once a provider and approved templates
 * exist, and respect user_settings.whatsapp_opt_in.
 */
export const whatsAppChannel: NotificationChannel = {
  id: "whatsapp",
  isEnabled: () => false,
  async send() {
    throw new Error("WhatsApp notifications are not configured.");
  },
};
