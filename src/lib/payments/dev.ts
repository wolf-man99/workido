import { randomUUID } from "node:crypto";
import { hmacSha256Hex, signaturesMatch } from "./signatures";
import type { NormalizedWebhookEvent, PaymentProvider } from "./types";

/**
 * DEVELOPMENT payment adapter. No money moves and nothing is sent to a real
 * provider. It exists so the full order lifecycle can be exercised locally.
 *
 * It still uses real cryptographic verification: "payments" are confirmed by
 * a server-generated HMAC signature (DEV_PAYMENTS_SECRET) that is checked by
 * the same verification path as Razorpay. The browser never supplies a
 * signature for this adapter. The UI always shows a "Test mode" banner.
 */
export function createDevProvider(secret: string): PaymentProvider {
  return {
    id: "dev",
    isLive: false,
    publicKey: null,

    async createOrder() {
      return { providerOrderId: `dev_order_${randomUUID()}` };
    },

    verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
      return signaturesMatch(hmacSha256Hex(secret, `${providerOrderId}|${providerPaymentId}`), signature);
    },

    verifyWebhookSignature(rawBody, signature) {
      return signaturesMatch(hmacSha256Hex(secret, rawBody), signature);
    },

    parseWebhookEvent(rawBody): NormalizedWebhookEvent | null {
      try {
        const event = JSON.parse(rawBody) as {
          id: string;
          type: string;
          providerOrderId?: string;
          providerPaymentId?: string;
          providerRefundId?: string;
          reason?: string;
        };
        if (event.type === "payment.succeeded" && event.providerOrderId && event.providerPaymentId) {
          return { kind: "payment_succeeded", eventId: event.id, type: event.type, providerOrderId: event.providerOrderId, providerPaymentId: event.providerPaymentId };
        }
        if (event.type === "payment.failed" && event.providerOrderId) {
          return {
            kind: "payment_failed",
            eventId: event.id,
            type: event.type,
            providerOrderId: event.providerOrderId,
            providerPaymentId: event.providerPaymentId ?? null,
            reason: event.reason ?? "Simulated failure",
          };
        }
        if (event.type === "refund.succeeded" && event.providerRefundId) {
          return { kind: "refund_succeeded", eventId: event.id, type: event.type, providerRefundId: event.providerRefundId };
        }
        return { kind: "ignored", eventId: event.id, type: event.type };
      } catch {
        return null;
      }
    },

    async createRefund() {
      return { providerRefundId: `dev_rfnd_${randomUUID()}`, status: "succeeded" };
    },
  };
}

/** Server-side helper that produces what a successful dev checkout returns. */
export function simulateDevPayment(secret: string, providerOrderId: string) {
  const providerPaymentId = `dev_pay_${randomUUID()}`;
  return { providerPaymentId, signature: hmacSha256Hex(secret, `${providerOrderId}|${providerPaymentId}`) };
}
