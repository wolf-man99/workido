import { beforeAll, describe, expect, it } from "vitest";
import { createPublishedSpecialist, createTestUser, markOrderPaid, type TestUser } from "../support/supabase";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("order messaging and private files", () => {
  let buyer: TestUser;
  let outsider: TestUser;
  let gig: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let orderId: string;
  let conversationId: string;

  beforeAll(async () => {
    buyer = await createTestUser("buyer", "Mia Messages");
    outsider = await createTestUser("buyer", "Eve Eavesdrop");
    gig = await createPublishedSpecialist();
    const { data } = await buyer.client.rpc("create_service_order", { p_service_id: gig.serviceId, p_brief: "Need a carousel for Diwali" });
    orderId = data!;
    const { data: conversation } = await buyer.client.from("conversations").select("id").eq("order_id", orderId).single();
    conversationId = conversation!.id;
  });

  it("lets participants exchange messages", async () => {
    const { error } = await buyer.client.from("messages").insert({ conversation_id: conversationId, sender_id: buyer.id, body: "Hi! Brand kit attached." });
    expect(error).toBeNull();
    const { data } = await gig.user.client.from("messages").select("body").eq("conversation_id", conversationId);
    expect(data?.map((m) => m.body)).toContain("Hi! Brand kit attached.");
  });

  it("blocks non-participants from reading or posting", async () => {
    const { data } = await outsider.client.from("messages").select("id").eq("conversation_id", conversationId);
    expect(data).toEqual([]);
    const { error } = await outsider.client.from("messages").insert({ conversation_id: conversationId, sender_id: outsider.id, body: "Let me in" });
    expect(error).not.toBeNull();
  });

  it("prevents spoofing the sender or sending system messages", async () => {
    // The database always attributes a message to the authenticated sender.
    const { data: spoofed } = await buyer.client
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: gig.user.id, body: "Fake message" })
      .select("sender_id")
      .single();
    expect(spoofed?.sender_id).toBe(buyer.id);
    const { error: system } = await buyer.client.from("messages").insert({
      conversation_id: conversationId,
      sender_id: buyer.id,
      message_type: "system",
      body: "Order approved by admin",
    });
    expect(system).not.toBeNull();
  });

  it("notifies the other participant about new messages", async () => {
    const { data } = await gig.user.client.from("notifications").select("type, link_path").eq("type", "message_received");
    expect(data?.[0]?.link_path).toBe(`/dashboard/messages/${conversationId}`);
  });

  it("keeps order files private to participants", async () => {
    const path = `${orderId}/messages/brief.png`;
    const { error: upload } = await buyer.client.storage.from("order-files").upload(path, PNG_BYTES, { contentType: "image/png" });
    expect(upload).toBeNull();

    const { error: outsiderDownload } = await outsider.client.storage.from("order-files").download(path);
    expect(outsiderDownload).not.toBeNull();
    const { data: signed, error: signError } = await outsider.client.storage.from("order-files").createSignedUrl(path, 60);
    expect(signed).toBeNull();
    expect(signError).not.toBeNull();

    const { data: specialistFile, error: specialistError } = await gig.user.client.storage.from("order-files").download(path);
    expect(specialistError).toBeNull();
    expect(specialistFile?.size).toBe(PNG_BYTES.length);
  });

  it("only lets the specialist upload deliverables once work has started", async () => {
    const early = `${orderId}/deliverables/early.png`;
    const { error: beforePaid } = await gig.user.client.storage.from("order-files").upload(early, PNG_BYTES, { contentType: "image/png" });
    expect(beforePaid).not.toBeNull();

    await markOrderPaid(orderId);
    await gig.user.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "accept" });

    const { error: buyerUpload } = await buyer.client.storage.from("order-files").upload(`${orderId}/deliverables/x.png`, PNG_BYTES, { contentType: "image/png" });
    expect(buyerUpload).not.toBeNull();
    const { error: ok } = await gig.user.client.storage.from("order-files").upload(`${orderId}/deliverables/final.png`, PNG_BYTES, { contentType: "image/png" });
    expect(ok).toBeNull();
  });

  it("rejects disallowed file types at the bucket level", async () => {
    const { error } = await buyer.client.storage
      .from("order-files")
      .upload(`${orderId}/messages/page.html`, new TextEncoder().encode("<script>alert(1)</script>"), { contentType: "text/html" });
    expect(error).not.toBeNull();
  });

  it("only lets users write to their own avatar folder", async () => {
    const { error: own } = await buyer.client.storage.from("avatars").upload(`${buyer.id}/avatar.png`, PNG_BYTES, { contentType: "image/png", upsert: true });
    expect(own).toBeNull();
    const { error: other } = await buyer.client.storage.from("avatars").upload(`${outsider.id}/avatar.png`, PNG_BYTES, { contentType: "image/png" });
    expect(other).not.toBeNull();
  });
});
