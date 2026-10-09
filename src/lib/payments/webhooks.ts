import type { NormalizedWebhookEvent, PaymentProvider } from "./types";

/** Persistence used by webhook processing (implemented with the service role). */
export interface WebhookStore {
  /** Records the event; returns false if this provider event was already received. */
  recordEvent(provider: string, eventId: string, type: string): Promise<boolean>;
  markEvent(provider: string, eventId: string, status: "processed" | "ignored" | "failed", error?: string): Promise<void>;
  applyPaymentSuccess(provider: string, providerOrderId: string, providerPaymentId: string): Promise<"applied" | "not_found" | string>;
  applyPaymentFailure(provider: string, providerOrderId: string, reason: string): Promise<"applied" | "not_found">;
  applyRefundSuccess(providerRefundId: string): Promise<"applied" | "not_found" | string>;
  applyRefundFailure(providerRefundId: string, reason: string): Promise<"applied" | "not_found">;
}

export type WebhookOutcome =
  | { status: 200; result: "processed" | "duplicate" | "ignored" }
  | { status: 400; result: "invalid_signature" | "malformed" }
  | { status: 500; result: "failed" };

/**
 * Verifies, de-duplicates and applies a provider webhook.
 * - Invalid signatures are rejected before anything is stored.
 * - Each provider event id is processed at most once (idempotent).
 * - Database transitions are themselves idempotent, so a retried event
 *   after a partial failure is safe.
 */
export async function processWebhook(provider: PaymentProvider, store: WebhookStore, rawBody: string, headers: Headers, signature: string | null): Promise<WebhookOutcome> {
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    return { status: 400, result: "invalid_signature" };
  }
  const event: NormalizedWebhookEvent | null = provider.parseWebhookEvent(rawBody, headers);
  if (!event) return { status: 400, result: "malformed" };

  const isNew = await store.recordEvent(provider.id, event.eventId, event.type);
  if (!isNew) return { status: 200, result: "duplicate" };

  try {
    let outcome: string;
    switch (event.kind) {
      case "payment_succeeded":
        outcome = await store.applyPaymentSuccess(provider.id, event.providerOrderId, event.providerPaymentId);
        break;
      case "payment_failed":
        outcome = await store.applyPaymentFailure(provider.id, event.providerOrderId, event.reason);
        break;
      case "refund_succeeded":
        outcome = await store.applyRefundSuccess(event.providerRefundId);
        break;
      case "refund_failed":
        outcome = await store.applyRefundFailure(event.providerRefundId, event.reason);
        break;
      default:
        await store.markEvent(provider.id, event.eventId, "ignored");
        return { status: 200, result: "ignored" };
    }
    if (outcome === "not_found") {
      // Not ours (e.g. another integration on the same account): acknowledge.
      await store.markEvent(provider.id, event.eventId, "ignored", "No matching record");
      return { status: 200, result: "ignored" };
    }
    await store.markEvent(provider.id, event.eventId, "processed");
    return { status: 200, result: "processed" };
  } catch (error) {
    await store.markEvent(provider.id, event.eventId, "failed", error instanceof Error ? error.message.slice(0, 500) : "error");
    return { status: 500, result: "failed" };
  }
}
