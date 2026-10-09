import { hmacSha256Hex, signaturesMatch } from "./signatures";
import { PaymentError, type NormalizedWebhookEvent, type PaymentProvider } from "./types";

const API = "https://api.razorpay.com/v1";

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | undefined;
  fetchImpl?: typeof fetch;
}

/**
 * Razorpay adapter using the REST API directly (no SDK dependency).
 *  - Orders API creates a provider order for the exact amount.
 *  - Checkout returns razorpay_payment_id/order_id/signature; the signature is
 *    HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 *  - Webhooks are signed with HMAC_SHA256(raw body, webhook secret) in the
 *    X-Razorpay-Signature header; X-Razorpay-Event-Id identifies the event.
 * See docs/PAYMENTS.md for setup.
 */
export function createRazorpayProvider(config: RazorpayConfig): PaymentProvider {
  const fetcher = config.fetchImpl ?? fetch;
  const auth = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;

  async function call<T>(path: string, body: unknown): Promise<T> {
    const response = await fetcher(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as T & { error?: { description?: string } };
    if (!response.ok) {
      throw new PaymentError(`Razorpay ${path} failed (${response.status}): ${json.error?.description ?? "unknown error"}`);
    }
    return json;
  }

  return {
    id: "razorpay",
    isLive: true,
    publicKey: config.keyId,

    async createOrder({ amountMinor, currency, receipt, notes }) {
      const order = await call<{ id: string }>("/orders", { amount: amountMinor, currency, receipt: receipt.slice(0, 40), notes });
      return { providerOrderId: order.id };
    },

    verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
      return signaturesMatch(hmacSha256Hex(config.keySecret, `${providerOrderId}|${providerPaymentId}`), signature);
    },

    verifyWebhookSignature(rawBody, signature) {
      if (!config.webhookSecret) return false;
      return signaturesMatch(hmacSha256Hex(config.webhookSecret, rawBody), signature);
    },

    parseWebhookEvent(rawBody, headers): NormalizedWebhookEvent | null {
      let event: {
        event?: string;
        payload?: {
          payment?: { entity?: { id?: string; order_id?: string; error_description?: string } };
          order?: { entity?: { id?: string } };
          refund?: { entity?: { id?: string } };
        };
      };
      try {
        event = JSON.parse(rawBody);
      } catch {
        return null;
      }
      const type = event.event ?? "unknown";
      const payment = event.payload?.payment?.entity;
      const refund = event.payload?.refund?.entity;
      // Fall back to a deterministic id if the header is missing.
      const eventId = headers.get("x-razorpay-event-id") ?? `${type}:${payment?.id ?? refund?.id ?? hmacSha256Hex("event", rawBody)}`;

      switch (type) {
        case "payment.captured":
        case "order.paid": {
          const orderId = payment?.order_id ?? event.payload?.order?.entity?.id;
          if (!orderId || !payment?.id) return { kind: "ignored", eventId, type };
          return { kind: "payment_succeeded", eventId, type, providerOrderId: orderId, providerPaymentId: payment.id };
        }
        case "payment.failed":
          if (!payment?.order_id) return { kind: "ignored", eventId, type };
          return {
            kind: "payment_failed",
            eventId,
            type,
            providerOrderId: payment.order_id,
            providerPaymentId: payment.id ?? null,
            reason: payment.error_description ?? "Payment failed",
          };
        case "refund.processed":
          if (!refund?.id) return { kind: "ignored", eventId, type };
          return { kind: "refund_succeeded", eventId, type, providerRefundId: refund.id };
        case "refund.failed":
          if (!refund?.id) return { kind: "ignored", eventId, type };
          return { kind: "refund_failed", eventId, type, providerRefundId: refund.id, reason: "Refund failed at provider" };
        default:
          return { kind: "ignored", eventId, type };
      }
    },

    async createRefund({ providerPaymentId, amountMinor, notes }) {
      const refund = await call<{ id: string; status?: string }>(`/payments/${encodeURIComponent(providerPaymentId)}/refund`, { amount: amountMinor, notes });
      return { providerRefundId: refund.id, status: refund.status === "processed" ? "succeeded" : "processing" };
    },
  };
}
