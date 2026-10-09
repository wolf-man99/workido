import { createHmac, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createPublishedSpecialist, createTestUser, service } from "../support/supabase";
import { createDevProvider } from "@/lib/payments/dev";
import { supabaseWebhookStore } from "@/lib/payments/service";
import { processWebhook } from "@/lib/payments/webhooks";

const SECRET = "integration-dev-secret-0123456789";
const provider = createDevProvider(SECRET);
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");

describe("payment webhooks against the database", () => {
  let orderId: string;
  let providerOrderId: string;

  beforeAll(async () => {
    const gig = await createPublishedSpecialist();
    const buyer = await createTestUser("buyer", "Webhook Buyer");
    const { data } = await buyer.client.rpc("create_service_order", { p_service_id: gig.serviceId, p_brief: "Webhook test order brief" });
    orderId = data!;
    providerOrderId = `dev_order_${randomUUID()}`;
    await service.from("payments").insert({
      order_id: orderId,
      provider: "dev",
      provider_order_id: providerOrderId,
      amount_minor: 150000,
      currency: "INR",
      idempotency_key: randomUUID(),
    });
  });

  it("rejects an unsigned or forged webhook without changing the order", async () => {
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.succeeded", providerOrderId, providerPaymentId: "dev_pay_forged" });
    const outcome = await processWebhook(provider, supabaseWebhookStore(service), body, new Headers(), "0".repeat(64));
    expect(outcome).toEqual({ status: 400, result: "invalid_signature" });
    const { data: order } = await service.from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("pending_payment");
  });

  it("applies a valid webhook exactly once", async () => {
    const eventId = `evt_${randomUUID()}`;
    const body = JSON.stringify({ id: eventId, type: "payment.succeeded", providerOrderId, providerPaymentId: `dev_pay_${randomUUID()}` });
    const store = supabaseWebhookStore(service);

    expect(await processWebhook(provider, store, body, new Headers(), sign(body))).toEqual({ status: 200, result: "processed" });
    expect(await processWebhook(provider, store, body, new Headers(), sign(body))).toEqual({ status: 200, result: "duplicate" });

    const { data: order } = await service.from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("paid");
    const { data: events } = await service.from("order_events").select("event_type").eq("order_id", orderId).eq("event_type", "payment_verified");
    expect(events).toHaveLength(1);
    const { data: logged } = await service.from("payment_webhook_events").select("processing_status").eq("provider_event_id", eventId).single();
    expect(logged?.processing_status).toBe("processed");
  });

  it("treats a second success event for the same payment as idempotent", async () => {
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.succeeded", providerOrderId, providerPaymentId: `dev_pay_${randomUUID()}` });
    const outcome = await processWebhook(provider, supabaseWebhookStore(service), body, new Headers(), sign(body));
    expect(outcome.status).toBe(200);
    const { data: events } = await service.from("order_events").select("event_type").eq("order_id", orderId).eq("event_type", "payment_verified");
    expect(events).toHaveLength(1);
  });

  it("acknowledges events for unknown payments", async () => {
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.succeeded", providerOrderId: "dev_order_unknown", providerPaymentId: "dev_pay_x" });
    expect(await processWebhook(provider, supabaseWebhookStore(service), body, new Headers(), sign(body))).toEqual({ status: 200, result: "ignored" });
  });
});
