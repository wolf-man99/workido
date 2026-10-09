import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addLinkDeliverable,
  anonClient,
  createPublishedSpecialist,
  createTestUser,
  markOrderPaid,
  service,
  type TestUser,
} from "../support/supabase";

describe("order lifecycle (Mode A: predefined gig)", () => {
  let buyer: TestUser;
  let outsider: TestUser;
  let gig: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let orderId: string;

  beforeAll(async () => {
    buyer = await createTestUser("buyer", "Olivia Orders");
    outsider = await createTestUser("buyer", "Nosy Neighbour");
    gig = await createPublishedSpecialist({ price: 150000, revisions: 1 });
  });

  it("creates an order with a server-side price snapshot", async () => {
    const { data, error } = await buyer.client.rpc("create_service_order", {
      p_service_id: gig.serviceId,
      p_brief: "Launch carousel for our monsoon collection, brand kit attached.",
    });
    expect(error).toBeNull();
    orderId = data!;
    const { data: order } = await buyer.client.from("orders").select("*").eq("id", orderId).single();
    expect(order).toMatchObject({ status: "pending_payment", price_minor: 150000, total_minor: 150000, currency: "INR", revisions_included: 1 });
    expect((order!.scope_snapshot as Record<string, unknown>).service_title).toBe("Instagram carousel design");

    // Later edits to the listing do not change the existing order.
    await gig.user.client.from("services").update({ price_minor: 990000 }).eq("id", gig.serviceId);
    const { data: unchanged } = await buyer.client.from("orders").select("price_minor").eq("id", orderId).single();
    expect(unchanged?.price_minor).toBe(150000);
    await gig.user.client.from("services").update({ price_minor: 150000 }).eq("id", gig.serviceId);
  });

  it("creates an order conversation for both participants", async () => {
    const { data } = await buyer.client.from("conversations").select("id").eq("order_id", orderId);
    expect(data).toHaveLength(1);
  });

  it("does not let buyers order their own service", async () => {
    const { error } = await gig.user.client.rpc("create_service_order", { p_service_id: gig.serviceId, p_brief: "Ordering from myself here" });
    expect(error?.message).toMatch(/own service/);
  });

  it("hides orders from non-participants", async () => {
    const { data } = await outsider.client.from("orders").select("id").eq("id", orderId);
    expect(data).toEqual([]);
    const { data: anonData } = await anonClient().from("orders").select("id").eq("id", orderId);
    expect(anonData).toEqual([]);
    const { error } = await outsider.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "cancel" });
    expect(error?.code).toBe("P0002");
  });

  it("prevents anyone but trusted server code from marking an order paid", async () => {
    const { error: update } = await buyer.client.from("orders").update({ status: "paid" }).eq("id", orderId);
    expect(update).not.toBeNull();
    const { error: rpc } = await buyer.client.rpc("apply_payment_success" as never, { p_payment_id: orderId, p_provider_payment_id: "x" } as never);
    expect(rpc).not.toBeNull();
    const { error: insert } = await buyer.client.from("payments").insert({
      order_id: orderId,
      provider: "dev",
      provider_order_id: "forged",
      amount_minor: 150000,
      currency: "INR",
      status: "succeeded",
      idempotency_key: "forged",
    });
    expect(insert).not.toBeNull();
    const { error: early } = await gig.user.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "accept" });
    expect(early?.code).toBe("23514");
  });

  it("moves to paid after verified payment and is idempotent", async () => {
    const paymentId = await markOrderPaid(orderId);
    const { data: again } = await service.rpc("apply_payment_success", { p_payment_id: paymentId, p_provider_payment_id: "dup" });
    expect(again).toBe("already_applied");
    const { data: order } = await buyer.client.from("orders").select("status, paid_at").eq("id", orderId).single();
    expect(order?.status).toBe("paid");
    expect(order?.paid_at).not.toBeNull();
  });

  it("only lets the assigned specialist accept", async () => {
    const { error: buyerAccept } = await buyer.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "accept" });
    expect(buyerAccept?.code).toBe("23514");
    const { data, error } = await gig.user.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "accept" });
    expect(error).toBeNull();
    expect(data?.status).toBe("in_progress");
    expect(data?.delivery_deadline).not.toBeNull();
  });

  it("requires deliverables before submission", async () => {
    const { error } = await gig.user.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "submit", p_note: "Here you go" });
    expect(error?.message).toMatch(/at least one file or link/);
  });

  it("only lets the specialist add deliverables, and hides drafts from the buyer", async () => {
    const { error: buyerUpload } = await buyer.client.from("order_deliverables").insert({
      order_id: orderId,
      uploaded_by: buyer.id,
      kind: "link",
      external_url: "https://example.com",
      filename: "Buyer link",
    });
    expect(buyerUpload).not.toBeNull();
    await addLinkDeliverable(gig.user, orderId);
    const { data: buyerView } = await buyer.client.from("order_deliverables").select("id").eq("order_id", orderId);
    expect(buyerView).toEqual([]);
  });

  it("submits work, then enforces the revision limit", async () => {
    const { data: submitted, error } = await gig.user.client.rpc("perform_order_action", {
      p_order_id: orderId,
      p_action: "submit",
      p_note: "First version attached.",
    });
    expect(error).toBeNull();
    expect(submitted?.status).toBe("submitted");
    const { data: buyerView } = await buyer.client.from("order_deliverables").select("id, submission_id").eq("order_id", orderId);
    expect(buyerView).toHaveLength(1);

    const { error: specialistApprove } = await gig.user.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "approve" });
    expect(specialistApprove?.code).toBe("23514");

    const { error: shortNote } = await buyer.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "request_revision", p_note: "fix" });
    expect(shortNote?.message).toMatch(/at least 10 characters/);

    const { data: revision, error: revisionError } = await buyer.client.rpc("perform_order_action", {
      p_order_id: orderId,
      p_action: "request_revision",
      p_note: "Please make the headline on slide 1 larger.",
    });
    expect(revisionError).toBeNull();
    expect(revision?.status).toBe("revision_requested");
    expect(revision?.revisions_used).toBe(1);

    await addLinkDeliverable(gig.user, orderId);
    await gig.user.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "submit", p_note: "Updated headline." });

    const { error: overLimit } = await buyer.client.rpc("perform_order_action", {
      p_order_id: orderId,
      p_action: "request_revision",
      p_note: "One more change please, the colours.",
    });
    expect(overLimit?.message).toMatch(/included revision/);
  });

  it("completes on approval and records the event history", async () => {
    const { data, error } = await buyer.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "approve" });
    expect(error).toBeNull();
    expect(data?.status).toBe("completed");
    expect(data?.payout_status).toBe("pending");

    const { data: events } = await buyer.client.from("order_events").select("event_type").eq("order_id", orderId).order("id");
    expect(events?.map((e) => e.event_type)).toEqual([
      "order_created",
      "payment_verified",
      "specialist_accepted",
      "work_started",
      "work_submitted",
      "revision_requested",
      "work_submitted",
      "deliverables_approved",
      "order_completed",
    ]);

    const { data: submissions } = await buyer.client.from("order_submissions").select("version").eq("order_id", orderId).order("version");
    expect(submissions?.map((s) => s.version)).toEqual([1, 2]);

    const { data: profile } = await service.from("specialist_profiles").select("completed_orders_count").eq("user_id", gig.user.id).single();
    expect(profile?.completed_orders_count).toBe(1);
  });

  it("does not let users rewrite history", async () => {
    const { error: update } = await buyer.client.from("order_events").update({ event_type: "order_cancelled" }).eq("order_id", orderId);
    expect(update).not.toBeNull();
    const { error: insert } = await buyer.client.from("order_events").insert({ order_id: orderId, event_type: "order_completed" });
    expect(insert).not.toBeNull();
    const { error: action } = await buyer.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "cancel" });
    expect(action?.code).toBe("23514");
  });

  it("restricts reviews to participants of completed orders, once each", async () => {
    const { error: outsiderReview } = await outsider.client.from("reviews").insert({
      order_id: orderId,
      reviewer_id: outsider.id,
      reviewee_id: gig.user.id,
      rating: 1,
    });
    expect(outsiderReview).not.toBeNull();

    const { error } = await buyer.client.from("reviews").insert({
      order_id: orderId,
      reviewer_id: buyer.id,
      reviewee_id: gig.user.id,
      rating: 5,
      comment: "Fast, friendly and exactly on brief.",
    });
    expect(error).toBeNull();

    const { error: duplicate } = await buyer.client.from("reviews").insert({
      order_id: orderId,
      reviewer_id: buyer.id,
      reviewee_id: gig.user.id,
      rating: 4,
    });
    expect(duplicate?.code).toBe("23505");

    const { error: tamper } = await buyer.client.from("reviews").update({ rating: 1 }).eq("order_id", orderId);
    expect(tamper).not.toBeNull();

    const { data: profile } = await anonClient().from("specialist_profiles").select("rating_avg, rating_count").eq("user_id", gig.user.id).single();
    expect(Number(profile?.rating_avg)).toBe(5);
    expect(profile?.rating_count).toBe(1);
  });

  it("rejects reviews on orders that are not completed", async () => {
    const { data: newOrder } = await buyer.client.rpc("create_service_order", { p_service_id: gig.serviceId, p_brief: "Another carousel please" });
    const { error } = await buyer.client.from("reviews").insert({ order_id: newOrder!, reviewer_id: buyer.id, reviewee_id: gig.user.id, rating: 5 });
    expect(error).not.toBeNull();
    const { data: cancelled } = await buyer.client.rpc("perform_order_action", { p_order_id: newOrder!, p_action: "cancel", p_note: "Changed my mind" });
    expect(cancelled?.status).toBe("cancelled");
    const { error: afterCancel } = await buyer.client.from("reviews").insert({ order_id: newOrder!, reviewer_id: buyer.id, reviewee_id: gig.user.id, rating: 5 });
    expect(afterCancel).not.toBeNull();
  });
});

describe("refunds and disputes", () => {
  it("refunds when a paid order is declined, after provider confirmation", async () => {
    const buyer = await createTestUser("buyer", "Rena Refund");
    const gig = await createPublishedSpecialist();
    const { data: orderId } = await buyer.client.rpc("create_service_order", { p_service_id: gig.serviceId, p_brief: "Need it by Monday morning" });
    await markOrderPaid(orderId!);
    const { data: declined } = await gig.user.client.rpc("perform_order_action", { p_order_id: orderId!, p_action: "decline", p_note: "Fully booked" });
    expect(declined?.status).toBe("refund_pending");

    const { data: refund } = await service.from("refunds").select("id, status, amount_minor").eq("order_id", orderId!).single();
    expect(refund).toMatchObject({ status: "pending", amount_minor: 150000 });
    // Buyers cannot fake the refund outcome.
    const { error } = await buyer.client.rpc("apply_refund_success" as never, { p_refund_id: refund!.id, p_provider_refund_id: "x" } as never);
    expect(error).not.toBeNull();

    const { error: refundError } = await service.rpc("apply_refund_success", { p_refund_id: refund!.id, p_provider_refund_id: `rfnd_${randomUUID()}` });
    expect(refundError).toBeNull();
    const { data: order } = await buyer.client.from("orders").select("status").eq("id", orderId!).single();
    expect(order?.status).toBe("refunded");
  });

  it("lets participants open a dispute and admins resolve it", async () => {
    const buyer = await createTestUser("buyer", "Dee Spute");
    const admin = await createTestUser("buyer", "Ari Admin");
    await service.from("user_roles").insert({ user_id: admin.id, role: "admin" });
    const gig = await createPublishedSpecialist();
    const { data: orderId } = await buyer.client.rpc("create_service_order", { p_service_id: gig.serviceId, p_brief: "Carousel for our product launch" });
    await markOrderPaid(orderId!);
    await gig.user.client.rpc("perform_order_action", { p_order_id: orderId!, p_action: "accept" });

    const { data: disputeId, error } = await buyer.client.rpc("open_dispute", {
      p_order_id: orderId!,
      p_reason: "no_response",
      p_description: "The specialist has not replied for five days after accepting.",
    });
    expect(error).toBeNull();

    const { error: selfResolve } = await buyer.client.rpc("resolve_dispute", {
      p_dispute_id: disputeId!,
      p_outcome: "refund_buyer",
      p_resolution: "I decide I get a refund",
    });
    expect(selfResolve?.code).toBe("42501");

    const { error: resolveError } = await admin.client.rpc("resolve_dispute", {
      p_dispute_id: disputeId!,
      p_outcome: "refund_buyer",
      p_resolution: "Specialist unresponsive; refunding the buyer in full.",
    });
    expect(resolveError).toBeNull();
    const { data: order } = await buyer.client.from("orders").select("status").eq("id", orderId!).single();
    expect(order?.status).toBe("refund_pending");
  });
});
