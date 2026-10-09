/**
 * Payment provider abstraction. The rest of the app depends only on this
 * interface, so providers can be swapped without touching order logic.
 *
 * Important: Workido does not hold funds or run a wallet/escrow. Buyer
 * payments go to the merchant account configured with the provider.
 * Specialist payouts are recorded manually by admins until a
 * provider-supported, legally reviewed settlement flow is configured.
 */

export type PaymentProviderId = "razorpay" | "dev";

export interface CreateOrderInput {
  amountMinor: number;
  currency: string;
  /** Our own reference (max 40 chars for Razorpay). */
  receipt: string;
  notes: Record<string, string>;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export type NormalizedWebhookEvent =
  | { kind: "payment_succeeded"; eventId: string; type: string; providerOrderId: string; providerPaymentId: string }
  | { kind: "payment_failed"; eventId: string; type: string; providerOrderId: string; providerPaymentId: string | null; reason: string }
  | { kind: "refund_succeeded"; eventId: string; type: string; providerRefundId: string }
  | { kind: "refund_failed"; eventId: string; type: string; providerRefundId: string; reason: string }
  | { kind: "ignored"; eventId: string; type: string };

export interface RefundResult {
  providerRefundId: string;
  /** "succeeded" only when the provider confirms the refund in its response. */
  status: "processing" | "succeeded";
}

export interface PaymentProvider {
  id: PaymentProviderId;
  /** False for the development adapter: no real money moves. */
  isLive: boolean;
  /** Public key for client-side checkout (Razorpay key_id); never a secret. */
  publicKey: string | null;
  createOrder(input: CreateOrderInput): Promise<{ providerOrderId: string }>;
  verifyPaymentSignature(input: VerifyPaymentInput): boolean;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseWebhookEvent(rawBody: string, headers: Headers): NormalizedWebhookEvent | null;
  createRefund(input: { providerPaymentId: string; amountMinor: number; notes: Record<string, string> }): Promise<RefundResult>;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly userMessage = "Payment could not be processed. Please try again.",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
