import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createDevProvider, simulateDevPayment } from "@/lib/payments/dev";
import { createRazorpayProvider } from "@/lib/payments/razorpay";
import { processWebhook, type WebhookStore } from "@/lib/payments/webhooks";

const hmac = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

const razorpay = createRazorpayProvider({ keyId: "rzp_test_key", keySecret: "key_secret", webhookSecret: "webhook_secret" });

describe("Razorpay payment signature verification", () => {
  it("accepts a valid checkout signature", () => {
    const signature = hmac("key_secret", "order_ABC|pay_XYZ");
    expect(razorpay.verifyPaymentSignature({ providerOrderId: "order_ABC", providerPaymentId: "pay_XYZ", signature })).toBe(true);
  });

  it("rejects forged or tampered signatures", () => {
    const signature = hmac("key_secret", "order_ABC|pay_XYZ");
    expect(razorpay.verifyPaymentSignature({ providerOrderId: "order_ABC", providerPaymentId: "pay_OTHER", signature })).toBe(false);
    expect(razorpay.verifyPaymentSignature({ providerOrderId: "order_ABC", providerPaymentId: "pay_XYZ", signature: hmac("wrong", "order_ABC|pay_XYZ") })).toBe(false);
    expect(razorpay.verifyPaymentSignature({ providerOrderId: "order_ABC", providerPaymentId: "pay_XYZ", signature: "not-hex" })).toBe(false);
    expect(razorpay.verifyPaymentSignature({ providerOrderId: "order_ABC", providerPaymentId: "pay_XYZ", signature: "abcd" })).toBe(false);
  });
});

describe("Razorpay webhooks", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
  });

  it("verifies the webhook signature over the raw body", () => {
    expect(razorpay.verifyWebhookSignature(body, hmac("webhook_secret", body))).toBe(true);
    expect(razorpay.verifyWebhookSignature(body, hmac("webhook_secret", `${body} `))).toBe(false);
    expect(razorpay.verifyWebhookSignature(body, null)).toBe(false);
  });

  it("refuses all webhooks when no webhook secret is configured", () => {
    const noSecret = createRazorpayProvider({ keyId: "k", keySecret: "s", webhookSecret: undefined });
    expect(noSecret.verifyWebhookSignature(body, hmac("", body))).toBe(false);
  });

  it("normalises events", () => {
    const headers = new Headers({ "x-razorpay-event-id": "evt_1" });
    expect(razorpay.parseWebhookEvent(body, headers)).toEqual({
      kind: "payment_succeeded",
      eventId: "evt_1",
      type: "payment.captured",
      providerOrderId: "order_1",
      providerPaymentId: "pay_1",
    });
    const failed = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_2", order_id: "order_1", error_description: "Card declined" } } } });
    expect(razorpay.parseWebhookEvent(failed, headers)).toMatchObject({ kind: "payment_failed", reason: "Card declined" });
    const refund = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1" } } } });
    expect(razorpay.parseWebhookEvent(refund, headers)).toMatchObject({ kind: "refund_succeeded", providerRefundId: "rfnd_1" });
    expect(razorpay.parseWebhookEvent(JSON.stringify({ event: "settlement.processed" }), headers)).toMatchObject({ kind: "ignored" });
    expect(razorpay.parseWebhookEvent("not json", headers)).toBeNull();
  });
});

describe("Razorpay API calls", () => {
  it("creates orders with basic auth and integer amounts", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "order_123" }), { status: 200 }));
    const provider = createRazorpayProvider({ keyId: "rzp_test", keySecret: "secret", webhookSecret: "w", fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await provider.createOrder({ amountMinor: 150000, currency: "INR", receipt: "WK-ABC", notes: { workido_order_id: "o1" } });
    expect(result.providerOrderId).toBe("order_123");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test:secret").toString("base64")}`);
    expect(JSON.parse(init.body as string)).toMatchObject({ amount: 150000, currency: "INR", receipt: "WK-ABC" });
  });

  it("surfaces provider errors", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { description: "Authentication failed" } }), { status: 401 }));
    const provider = createRazorpayProvider({ keyId: "k", keySecret: "s", webhookSecret: "w", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(provider.createOrder({ amountMinor: 100, currency: "INR", receipt: "r", notes: {} })).rejects.toThrow(/Authentication failed/);
  });
});

describe("development payment adapter", () => {
  const dev = createDevProvider("dev-secret-0123456789");

  it("is never presented as live", () => {
    expect(dev.isLive).toBe(false);
  });

  it("verifies only server-generated signatures", async () => {
    const { providerOrderId } = await dev.createOrder({ amountMinor: 100, currency: "INR", receipt: "r", notes: {} });
    const simulated = simulateDevPayment("dev-secret-0123456789", providerOrderId);
    expect(dev.verifyPaymentSignature({ providerOrderId, ...simulated })).toBe(true);
    expect(dev.verifyPaymentSignature({ providerOrderId, providerPaymentId: simulated.providerPaymentId, signature: hmac("guess", `${providerOrderId}|x`) })).toBe(false);
  });
});

function fakeStore(overrides: Partial<WebhookStore> = {}) {
  const seen = new Set<string>();
  const store: WebhookStore & { applied: string[]; marks: string[] } = {
    applied: [],
    marks: [],
    async recordEvent(provider, eventId) {
      const key = `${provider}:${eventId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    async markEvent(_provider, eventId, status) {
      store.marks.push(`${eventId}:${status}`);
    },
    async applyPaymentSuccess(_provider, providerOrderId) {
      store.applied.push(`paid:${providerOrderId}`);
      return "applied";
    },
    async applyPaymentFailure(_provider, providerOrderId) {
      store.applied.push(`failed:${providerOrderId}`);
      return "applied";
    },
    async applyRefundSuccess(id) {
      store.applied.push(`refunded:${id}`);
      return "applied";
    },
    async applyRefundFailure(id) {
      store.applied.push(`refund_failed:${id}`);
      return "applied";
    },
    ...overrides,
  };
  return store;
}

describe("processWebhook", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } });
  const headers = new Headers({ "x-razorpay-event-id": "evt_42" });
  const signature = hmac("webhook_secret", body);

  it("applies a valid event once and ignores duplicates", async () => {
    const store = fakeStore();
    expect(await processWebhook(razorpay, store, body, headers, signature)).toEqual({ status: 200, result: "processed" });
    expect(await processWebhook(razorpay, store, body, headers, signature)).toEqual({ status: 200, result: "duplicate" });
    expect(store.applied).toEqual(["paid:order_1"]);
  });

  it("rejects invalid signatures without touching the store", async () => {
    const store = fakeStore();
    expect(await processWebhook(razorpay, store, body, headers, "deadbeef")).toEqual({ status: 400, result: "invalid_signature" });
    expect(store.applied).toEqual([]);
    expect(store.marks).toEqual([]);
  });

  it("acknowledges events for unknown payments without failing", async () => {
    const store = fakeStore({ applyPaymentSuccess: async () => "not_found" });
    expect(await processWebhook(razorpay, store, body, headers, signature)).toEqual({ status: 200, result: "ignored" });
  });

  it("returns 500 so the provider retries when processing fails", async () => {
    const store = fakeStore({
      applyPaymentSuccess: async () => {
        throw new Error("db down");
      },
    });
    expect(await processWebhook(razorpay, store, body, headers, signature)).toEqual({ status: 500, result: "failed" });
    expect(store.marks).toContain("evt_42:failed");
  });
});
