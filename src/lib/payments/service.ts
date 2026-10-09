import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient, type ServiceSupabaseClient } from "@/lib/supabase/admin";
import { simulateDevPayment } from "./dev";
import { getPaymentConfig } from "./provider";
import { PaymentError, type PaymentProvider, type PaymentProviderId } from "./types";
import type { WebhookStore } from "./webhooks";
import { getServerEnv } from "@/lib/config/server-env";

export interface CheckoutSession {
  provider: PaymentProviderId;
  isLive: boolean;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  publicKey: string | null;
}

function requireProvider(): PaymentProvider {
  const config = getPaymentConfig();
  if (!config.configured) throw new PaymentError(config.reason, "Payments aren't available right now. Please try again later.");
  return config.provider;
}

/**
 * Creates (or reuses) a provider order for an order awaiting payment.
 * The caller must already have verified that `buyerId` owns the order.
 * Amounts always come from the database order, never from the client.
 */
export async function startCheckout(orderId: string, buyerId: string): Promise<CheckoutSession> {
  const provider = requireProvider();
  const db = createSupabaseServiceClient();

  const { data: order, error } = await db.from("orders").select("id, buyer_id, status, total_minor, currency, order_number").eq("id", orderId).single();
  if (error || !order || order.buyer_id !== buyerId) throw new PaymentError("Order not found", "Order not found.");
  if (order.status !== "pending_payment") throw new PaymentError("Order is not awaiting payment", "This order doesn't need payment.");
  const amount = order.total_minor ?? 0;

  // Idempotent: reuse an open attempt for the same provider and amount.
  const { data: existing } = await db
    .from("payments")
    .select("provider_order_id, amount_minor, currency")
    .eq("order_id", orderId)
    .eq("provider", provider.id)
    .eq("status", "created")
    .eq("amount_minor", amount)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { provider: provider.id, isLive: provider.isLive, providerOrderId: existing.provider_order_id, amountMinor: amount, currency: existing.currency, publicKey: provider.publicKey };
  }

  const { providerOrderId } = await provider.createOrder({
    amountMinor: amount,
    currency: order.currency,
    receipt: order.order_number,
    notes: { workido_order_id: order.id },
  });
  const { error: insertError } = await db.from("payments").insert({
    order_id: order.id,
    provider: provider.id,
    provider_order_id: providerOrderId,
    amount_minor: amount,
    currency: order.currency,
    idempotency_key: `${order.id}:${randomUUID()}`,
  });
  if (insertError) throw new PaymentError(`Could not record payment attempt: ${insertError.message}`);
  await db.from("order_events").insert({ order_id: order.id, actor_id: buyerId, event_type: "payment_initiated", metadata: { provider: provider.id } });

  return { provider: provider.id, isLive: provider.isLive, providerOrderId, amountMinor: amount, currency: order.currency, publicKey: provider.publicKey };
}

/**
 * Verifies a checkout callback signature server-side and applies the payment.
 * A forged or tampered callback fails signature verification and changes nothing.
 */
export async function verifyCheckoutPayment(input: {
  orderId: string;
  buyerId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<"applied" | "already_applied" | string> {
  const provider = requireProvider();
  if (!provider.verifyPaymentSignature(input)) {
    throw new PaymentError("Invalid payment signature", "We couldn't verify this payment. If you were charged, it will be confirmed automatically or refunded.");
  }
  const db = createSupabaseServiceClient();
  const { data: payment } = await db
    .from("payments")
    .select("id, order_id, orders!inner(buyer_id)")
    .eq("provider", provider.id)
    .eq("provider_order_id", input.providerOrderId)
    .maybeSingle();
  if (!payment || payment.order_id !== input.orderId || payment.orders.buyer_id !== input.buyerId) {
    throw new PaymentError("Payment does not belong to this order", "We couldn't match this payment to your order.");
  }
  const { data, error } = await db.rpc("apply_payment_success", { p_payment_id: payment.id, p_provider_payment_id: input.providerPaymentId });
  if (error) throw new PaymentError(`apply_payment_success failed: ${error.message}`);
  return data;
}

/** Records a client-reported failure (e.g. card declined). Never marks success. */
export async function recordCheckoutFailure(input: { orderId: string; buyerId: string; providerOrderId: string; reason: string }) {
  const provider = requireProvider();
  const db = createSupabaseServiceClient();
  const { data: payment } = await db
    .from("payments")
    .select("id, order_id, orders!inner(buyer_id)")
    .eq("provider", provider.id)
    .eq("provider_order_id", input.providerOrderId)
    .maybeSingle();
  if (!payment || payment.order_id !== input.orderId || payment.orders.buyer_id !== input.buyerId) return;
  await db.rpc("apply_payment_failure", { p_payment_id: payment.id, p_reason: input.reason.slice(0, 300) });
}

/** Development adapter only: simulates the provider's successful checkout response. */
export async function completeDevCheckout(input: { orderId: string; buyerId: string; providerOrderId: string; outcome: "success" | "failure" }) {
  const provider = requireProvider();
  if (provider.id !== "dev") throw new PaymentError("Dev checkout used with a live provider", "This action isn't available.");
  if (input.outcome === "failure") {
    await recordCheckoutFailure({ ...input, reason: "Simulated failure (development mode)" });
    return "failed";
  }
  const secret = getServerEnv().DEV_PAYMENTS_SECRET ?? "";
  const { providerPaymentId, signature } = simulateDevPayment(secret, input.providerOrderId);
  return verifyCheckoutPayment({ ...input, providerPaymentId, signature });
}

/**
 * Admin-initiated refund through the provider. The order only becomes
 * "refunded" when the provider confirms (API response or webhook).
 */
export async function executeRefund(refundId: string): Promise<"succeeded" | "processing"> {
  const provider = requireProvider();
  const db = createSupabaseServiceClient();
  const { data: refund, error } = await db
    .from("refunds")
    .select("id, status, amount_minor, order_id, payments!inner(provider, provider_payment_id)")
    .eq("id", refundId)
    .single();
  if (error || !refund) throw new PaymentError("Refund not found", "Refund not found.");
  if (refund.status === "succeeded") return "succeeded";
  if (refund.payments.provider !== provider.id || !refund.payments.provider_payment_id) {
    throw new PaymentError("Refund provider mismatch", "This refund must be processed with the provider that took the payment.");
  }
  const result = await provider.createRefund({
    providerPaymentId: refund.payments.provider_payment_id,
    amountMinor: refund.amount_minor,
    notes: { workido_refund_id: refund.id, workido_order_id: refund.order_id },
  });
  await db.rpc("mark_refund_processing", { p_refund_id: refund.id, p_provider_refund_id: result.providerRefundId });
  if (result.status === "succeeded") {
    await db.rpc("apply_refund_success", { p_refund_id: refund.id, p_provider_refund_id: result.providerRefundId });
  }
  return result.status;
}

/** Service-role implementation of the webhook store. */
export function supabaseWebhookStore(db: ServiceSupabaseClient = createSupabaseServiceClient()): WebhookStore {
  async function paymentId(provider: string, providerOrderId: string) {
    const { data } = await db.from("payments").select("id").eq("provider", provider).eq("provider_order_id", providerOrderId).maybeSingle();
    return data?.id ?? null;
  }
  async function refundId(providerRefundId: string) {
    const { data } = await db.from("refunds").select("id").eq("provider_refund_id", providerRefundId).maybeSingle();
    return data?.id ?? null;
  }
  return {
    async recordEvent(provider, eventId, type) {
      const { data, error } = await db
        .from("payment_webhook_events")
        .upsert({ provider, provider_event_id: eventId, event_type: type }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async markEvent(provider, eventId, status, message) {
      await db
        .from("payment_webhook_events")
        .update({ processing_status: status, error: message ?? null, processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("provider_event_id", eventId);
    },
    async applyPaymentSuccess(provider, providerOrderId, providerPaymentId) {
      const id = await paymentId(provider, providerOrderId);
      if (!id) return "not_found";
      const { data, error } = await db.rpc("apply_payment_success", { p_payment_id: id, p_provider_payment_id: providerPaymentId });
      if (error) throw new Error(error.message);
      return data;
    },
    async applyPaymentFailure(provider, providerOrderId, reason) {
      const id = await paymentId(provider, providerOrderId);
      if (!id) return "not_found";
      const { error } = await db.rpc("apply_payment_failure", { p_payment_id: id, p_reason: reason });
      if (error) throw new Error(error.message);
      return "applied";
    },
    async applyRefundSuccess(providerRefundId) {
      const id = await refundId(providerRefundId);
      if (!id) return "not_found";
      const { data, error } = await db.rpc("apply_refund_success", { p_refund_id: id, p_provider_refund_id: providerRefundId });
      if (error) throw new Error(error.message);
      return data;
    },
    async applyRefundFailure(providerRefundId, reason) {
      const id = await refundId(providerRefundId);
      if (!id) return "not_found";
      const { error } = await db.rpc("apply_refund_failure", { p_refund_id: id, p_reason: reason });
      if (error) throw new Error(error.message);
      return "applied";
    },
  };
}
