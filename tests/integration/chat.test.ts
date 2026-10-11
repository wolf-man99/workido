import { beforeAll, describe, expect, it } from "vitest";
import { CONTACT_CASES } from "../support/contact-cases";
import { anonClient, createPublishedSpecialist, createTestUser, service, type TestUser } from "../support/supabase";

const WEBM_BYTES = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const proposalArgs = (conversationId: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  p_conversation_id: conversationId,
  p_title: "Carousel plus stories",
  p_description: "An 8-slide carousel and three matching 9:16 stories from your brand kit.",
  p_deliverables: "8 carousel slides and 3 stories as PNG",
  p_price_minor: 400000,
  p_delivery_time_hours: 96,
  p_revisions_included: 2,
  ...overrides,
});

async function openEnquiry(buyer: TestUser, specialist: Awaited<ReturnType<typeof createPublishedSpecialist>>) {
  const { data, error } = await buyer.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id, p_service_id: specialist.serviceId });
  if (error) throw error;
  return data!;
}

describe("chat proposals", () => {
  let specialist: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let buyer: TestUser;
  let outsider: TestUser;
  let conversationId: string;

  beforeAll(async () => {
    specialist = await createPublishedSpecialist();
    buyer = await createTestUser("buyer", "Priya Proposal");
    outsider = await createTestUser("buyer", "Olly Outsider");
    conversationId = await openEnquiry(buyer, specialist);
  });

  it("lets only the specialist send a proposal, posts it in the chat and notifies the buyer", async () => {
    const { error: buyerTry } = await buyer.client.rpc("send_proposal", proposalArgs(conversationId));
    expect(buyerTry?.code).toBe("42501");

    const { data: proposalId, error } = await specialist.user.client.rpc("send_proposal", proposalArgs(conversationId));
    expect(error).toBeNull();
    const { data: proposal } = await buyer.client.from("chat_proposals").select("status, price_minor, service_id, buyer_id").eq("id", proposalId!).single();
    expect(proposal).toEqual({ status: "pending", price_minor: 400000, service_id: specialist.serviceId, buyer_id: buyer.id });

    const { data: event } = await buyer.client.from("messages").select("message_type, sender_id, body").eq("proposal_id", proposalId!).single();
    expect(event).toEqual({ message_type: "system", sender_id: specialist.user.id, body: "Sent a proposal: Carousel plus stories · ₹4,000 · 4 days" });
    const { data: notification } = await service.from("notifications").select("type, link_path").eq("user_id", buyer.id).eq("type", "proposal_received").single();
    expect(notification?.link_path).toBe(`/dashboard/messages/${conversationId}`);

    const { data: peek } = await outsider.client.from("chat_proposals").select("id").eq("id", proposalId!);
    expect(peek).toEqual([]);
    expect((await outsider.client.rpc("accept_proposal", { p_proposal_id: proposalId! })).error?.code).toBe("P0002");
    expect((await anonClient().rpc("accept_proposal", { p_proposal_id: proposalId! })).error).not.toBeNull();
  });

  it("can't be written directly or faked as a message", async () => {
    const { error: insert } = await specialist.user.client.from("chat_proposals").insert({
      conversation_id: conversationId,
      buyer_id: buyer.id,
      specialist_id: specialist.user.id,
      title: "Sneaky proposal",
      description: "Trying to skip the proposal function entirely.",
      deliverables: "Nothing",
      price_minor: 10000,
      delivery_time_hours: 1,
      revisions_included: 0,
    });
    expect(insert).not.toBeNull();
    const { data: open } = await buyer.client.from("chat_proposals").select("id").eq("conversation_id", conversationId).eq("status", "pending").single();
    const { data: updated } = await buyer.client.from("chat_proposals").update({ price_minor: 10000 }).eq("id", open!.id).select();
    expect(updated ?? []).toEqual([]);
    const { error: fakeEvent } = await specialist.user.client
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: specialist.user.id, body: "Accepted!", proposal_id: open!.id });
    expect(fakeEvent?.code).toBe("42501");
  });

  it("replaces the open proposal when the specialist sends a new one", async () => {
    const { data: newer } = await specialist.user.client.rpc("send_proposal", proposalArgs(conversationId, { p_price_minor: 450000 }));
    const { data: rows } = await buyer.client.from("chat_proposals").select("id, status").eq("conversation_id", conversationId).order("created_at");
    expect(rows?.map((row) => row.status)).toEqual(["withdrawn", "pending"]);
    expect(rows?.at(-1)?.id).toBe(newer);
  });

  it("allows exactly one counter-offer; if it's declined the buyer can accept the original", async () => {
    const { data: proposal } = await buyer.client.from("chat_proposals").select("id").eq("conversation_id", conversationId).eq("status", "pending").single();
    const id = proposal!.id;

    const { error: unchanged } = await buyer.client.rpc("counter_proposal", { p_proposal_id: id, p_price_minor: 450000, p_delivery_time_hours: 96 });
    expect(unchanged?.message).toMatch(/Change the price or the delivery time/);
    const { error: specialistCounter } = await specialist.user.client.rpc("counter_proposal", { p_proposal_id: id, p_price_minor: 300000, p_delivery_time_hours: 72 });
    expect(specialistCounter?.code).toBe("42501");

    const { error: counter } = await buyer.client.rpc("counter_proposal", { p_proposal_id: id, p_price_minor: 380000, p_delivery_time_hours: 72, p_note: "Could we do 3 days?" });
    expect(counter).toBeNull();
    const { data: notified } = await service.from("notifications").select("id").eq("user_id", specialist.user.id).eq("type", "proposal_countered");
    expect(notified).toHaveLength(1);
    // The buyer can't accept while their counter is waiting.
    expect((await buyer.client.rpc("accept_proposal", { p_proposal_id: id })).error?.code).toBe("23514");

    const { data: none, error: declineCounter } = await specialist.user.client.rpc("respond_to_counter", { p_proposal_id: id, p_accept: false });
    expect(declineCounter).toBeNull();
    expect(none).toBeNull();
    const { error: secondCounter } = await buyer.client.rpc("counter_proposal", { p_proposal_id: id, p_price_minor: 350000, p_delivery_time_hours: 72 });
    expect(secondCounter?.message).toMatch(/already made your counter-offer/);

    const { data: orderId, error } = await buyer.client.rpc("accept_proposal", { p_proposal_id: id });
    expect(error).toBeNull();
    const { data: order } = await buyer.client
      .from("orders")
      .select("status, source, proposal_id, service_id, price_minor, delivery_time_hours, revisions_included, scope_snapshot")
      .eq("id", orderId!)
      .single();
    expect(order).toMatchObject({
      status: "pending_payment",
      source: "proposal",
      proposal_id: id,
      service_id: specialist.serviceId,
      price_minor: 450000,
      delivery_time_hours: 96,
      revisions_included: 2,
    });
    expect(order?.scope_snapshot).toMatchObject({ source: "proposal", agreed_terms: "original", counter_note: "Could we do 3 days?" });
    // The order announces itself through the proposal event, not a second note.
    const { data: notes } = await buyer.client.from("messages").select("body").eq("conversation_id", conversationId).is("proposal_id", null).eq("message_type", "system");
    expect(notes).toEqual([]);
    expect((await buyer.client.rpc("accept_proposal", { p_proposal_id: id })).error?.code).toBe("23514");
  });

  it("creates the order at the counter-offer terms when the specialist accepts it", async () => {
    const otherBuyer = await createTestUser("buyer", "Chris Counter");
    const chat = await openEnquiry(otherBuyer, specialist);
    const { data: id } = await specialist.user.client.rpc("send_proposal", proposalArgs(chat));
    await otherBuyer.client.rpc("counter_proposal", { p_proposal_id: id!, p_price_minor: 350000, p_delivery_time_hours: 120 });

    const { data: orderId, error } = await specialist.user.client.rpc("respond_to_counter", { p_proposal_id: id!, p_accept: true });
    expect(error).toBeNull();
    const { data: order } = await otherBuyer.client.from("orders").select("buyer_id, price_minor, delivery_time_hours, status").eq("id", orderId!).single();
    expect(order).toEqual({ buyer_id: otherBuyer.id, price_minor: 350000, delivery_time_hours: 120, status: "pending_payment" });
    const { data: notification } = await service.from("notifications").select("link_path").eq("user_id", otherBuyer.id).eq("type", "proposal_accepted").single();
    expect(notification?.link_path).toBe(`/dashboard/orders/${orderId}/checkout`);
  });

  it("refuses expired, declined and withdrawn proposals", async () => {
    const lateBuyer = await createTestUser("buyer", "Leo Late");
    const chat = await openEnquiry(lateBuyer, specialist);
    const { data: expiring } = await specialist.user.client.rpc("send_proposal", proposalArgs(chat));
    await service.from("chat_proposals").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", expiring!);
    expect((await lateBuyer.client.rpc("accept_proposal", { p_proposal_id: expiring! })).error?.message).toMatch(/expired/);

    const { data: declined } = await specialist.user.client.rpc("send_proposal", proposalArgs(chat));
    expect((await lateBuyer.client.rpc("decline_proposal", { p_proposal_id: declined! })).error).toBeNull();
    expect((await lateBuyer.client.rpc("accept_proposal", { p_proposal_id: declined! })).error?.code).toBe("23514");

    const { data: withdrawn } = await specialist.user.client.rpc("send_proposal", proposalArgs(chat));
    expect((await specialist.user.client.rpc("withdraw_proposal", { p_proposal_id: withdrawn! })).error).toBeNull();
    expect((await lateBuyer.client.rpc("accept_proposal", { p_proposal_id: withdrawn! })).error?.code).toBe("23514");
  });

  it("is only available before an order, in the specialist's own enquiries", async () => {
    const { data: orderId } = await buyer.client.rpc("create_service_order", { p_service_id: specialist.serviceId, p_brief: "Ordering the listed gig directly." });
    const { data: orderChat } = await service.from("conversations").select("id").eq("order_id", orderId!).single();
    const { error } = await specialist.user.client.rpc("send_proposal", proposalArgs(orderChat!.id));
    expect(error?.code).toBe("23514");
  });

  it("keeps the order when the buyer deletes their account", async () => {
    const leaver = await createTestUser("buyer", "Dee Departs");
    const chat = await openEnquiry(leaver, specialist);
    const { data: id } = await specialist.user.client.rpc("send_proposal", proposalArgs(chat));
    const { data: orderId } = await leaver.client.rpc("accept_proposal", { p_proposal_id: id! });
    const { data: result, error } = await leaver.client.rpc("delete_my_account", { p_confirmation: "Delete my Workido account" });
    expect(error).toBeNull();
    expect(result).toBe("anonymised");
    const { data: order } = await service.from("orders").select("source, proposal_id, status").eq("id", orderId!).single();
    expect(order).toEqual({ source: "proposal", proposal_id: null, status: "cancelled" });
  });
});

describe("chat messages: replies, files, voice notes and contact flags", () => {
  let specialist: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let buyer: TestUser;
  let outsider: TestUser;
  let conversationId: string;
  let otherConversationId: string;

  beforeAll(async () => {
    specialist = await createPublishedSpecialist();
    buyer = await createTestUser("buyer", "Rae Replies");
    outsider = await createTestUser("buyer", "Ned Nosy");
    conversationId = await openEnquiry(buyer, specialist);
    otherConversationId = await openEnquiry(outsider, specialist);
  });

  it("threads replies within the same conversation only", async () => {
    const { data: first } = await buyer.client.from("messages").insert({ conversation_id: conversationId, sender_id: buyer.id, body: "Do you do logos too?" }).select("id").single();
    const { error } = await specialist.user.client
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: specialist.user.id, body: "Yes, simple ones.", reply_to_id: first!.id });
    expect(error).toBeNull();
    const { error: crossChat } = await outsider.client
      .from("messages")
      .insert({ conversation_id: otherConversationId, sender_id: outsider.id, body: "Replying elsewhere", reply_to_id: first!.id });
    expect(crossChat?.message).toMatch(/reply to a message in this conversation/);
  });

  it("flags contact and payment details the same way as the app", async () => {
    for (const [body, expected] of CONTACT_CASES) {
      const { data, error } = await buyer.client
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: buyer.id, body, contact_flagged: !expected })
        .select("contact_flagged")
        .single();
      expect(error).toBeNull();
      expect({ body, flagged: data?.contact_flagged }).toEqual({ body, flagged: expected });
    }
  });

  it("lets participants share files and voice notes before an order", async () => {
    const image = `${conversationId}/reference.png`;
    expect((await buyer.client.storage.from("chat-files").upload(image, PNG_BYTES, { contentType: "image/png" })).error).toBeNull();
    const voice = `${conversationId}/voice-note.webm`;
    expect((await buyer.client.storage.from("chat-files").upload(voice, WEBM_BYTES, { contentType: "audio/webm" })).error).toBeNull();

    const { data, error } = await buyer.client
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: buyer.id,
        message_type: "file",
        attachment_path: voice,
        attachment_name: "Voice note",
        attachment_type: "audio/webm",
        attachment_size: WEBM_BYTES.length,
        attachment_duration_seconds: 12,
      })
      .select("attachment_duration_seconds")
      .single();
    expect(error).toBeNull();
    expect(data?.attachment_duration_seconds).toBe(12);

    // A duration on a non-audio file is dropped.
    const { data: picture } = await buyer.client
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: buyer.id, message_type: "file", attachment_path: image, attachment_name: "reference.png", attachment_type: "image/png", attachment_duration_seconds: 5 })
      .select("attachment_duration_seconds")
      .single();
    expect(picture?.attachment_duration_seconds).toBeNull();

    const { data: heard, error: listenError } = await specialist.user.client.storage.from("chat-files").download(voice);
    expect(listenError).toBeNull();
    expect(heard?.size).toBe(WEBM_BYTES.length);
  });

  it("keeps pre-order files private and in their own conversation", async () => {
    const path = `${conversationId}/private.png`;
    await buyer.client.storage.from("chat-files").upload(path, PNG_BYTES, { contentType: "image/png" });
    expect((await outsider.client.storage.from("chat-files").download(path)).error).not.toBeNull();
    expect((await outsider.client.storage.from("chat-files").upload(`${conversationId}/intrude.png`, PNG_BYTES, { contentType: "image/png" })).error).not.toBeNull();

    const { error } = await outsider.client.from("messages").insert({
      conversation_id: otherConversationId,
      sender_id: outsider.id,
      message_type: "file",
      attachment_path: path,
      attachment_name: "stolen.png",
    });
    expect(error?.message).toMatch(/Invalid attachment path/);

    const { error: html } = await buyer.client.storage
      .from("chat-files")
      .upload(`${conversationId}/page.html`, new TextEncoder().encode("<script>alert(1)</script>"), { contentType: "text/html" });
    expect(html).not.toBeNull();
  });

  it("accepts voice notes in order chats too", async () => {
    const { data: orderId } = await buyer.client.rpc("create_service_order", { p_service_id: specialist.serviceId, p_brief: "Order with a voice brief." });
    const { error } = await buyer.client.storage.from("order-files").upload(`${orderId}/messages/brief.webm`, WEBM_BYTES, { contentType: "audio/webm" });
    expect(error).toBeNull();
  });
});
