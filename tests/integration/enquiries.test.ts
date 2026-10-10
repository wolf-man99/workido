import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, createPublishedSpecialist, createTestUser, service, type TestUser } from "../support/supabase";

describe("pre-order enquiries", () => {
  let specialist: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let buyer: TestUser;
  let outsider: TestUser;
  let conversationId: string;

  beforeAll(async () => {
    specialist = await createPublishedSpecialist();
    buyer = await createTestUser("buyer", "Eli Enquirer");
    outsider = await createTestUser("buyer", "Nosy Neighbour");
  });

  it("opens one conversation per buyer and specialist, about a gig", async () => {
    const { data, error } = await buyer.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id, p_service_id: specialist.serviceId });
    expect(error).toBeNull();
    conversationId = data!;
    const { data: again } = await buyer.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id });
    expect(again).toBe(conversationId);

    const { data: conversation } = await service.from("conversations").select("kind, order_id, buyer_id, specialist_id, service_id").eq("id", conversationId).single();
    expect(conversation).toEqual({ kind: "enquiry", order_id: null, buyer_id: buyer.id, specialist_id: specialist.user.id, service_id: specialist.serviceId });
    const { data: participants } = await service.from("conversation_participants").select("user_id").eq("conversation_id", conversationId);
    expect(participants?.map((row) => row.user_id).sort()).toEqual([buyer.id, specialist.user.id].sort());
  });

  it("rejects messaging yourself, unpublished specialists and other people's gigs", async () => {
    expect((await specialist.user.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id })).error?.code).toBe("23514");
    const draft = await createTestUser("specialist", "Draft Specialist");
    expect((await buyer.client.rpc("start_enquiry", { p_specialist_id: draft.id })).error?.code).toBe("P0002");
    const other = await createPublishedSpecialist();
    expect((await buyer.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id, p_service_id: other.serviceId })).error?.code).toBe("P0002");
    expect((await anonClient().rpc("start_enquiry", { p_specialist_id: specialist.user.id })).error).not.toBeNull();
  });

  it("hides the enquiry from the specialist until the buyer writes", async () => {
    const { data: specialistInbox } = await specialist.user.client.rpc("list_my_conversations");
    expect(specialistInbox?.some((row) => row.conversation_id === conversationId)).toBe(false);
    const { data: buyerInbox } = await buyer.client.rpc("list_my_conversations");
    expect(buyerInbox?.find((row) => row.conversation_id === conversationId)).toMatchObject({ kind: "enquiry", service_title: "Instagram carousel design" });
  });

  it("lets the two of them talk, notifies the specialist and keeps others out", async () => {
    const { error } = await buyer.client.from("messages").insert({ conversation_id: conversationId, sender_id: buyer.id, body: "Hi! Can you match our brand fonts?" });
    expect(error).toBeNull();
    const { error: reply } = await specialist.user.client
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: specialist.user.id, body: "Yes, send them over after you order." });
    expect(reply).toBeNull();

    const { data: notification } = await service
      .from("notifications")
      .select("type, title, body, link_path")
      .eq("user_id", specialist.user.id)
      .eq("related_entity_id", conversationId)
      .single();
    expect(notification).toEqual({
      type: "message_received",
      title: "New message from Eli Enquirer",
      body: "Instagram carousel design",
      link_path: `/dashboard/messages/${conversationId}`,
    });
    const { data: specialistInbox } = await specialist.user.client.rpc("list_my_conversations");
    expect(specialistInbox?.find((row) => row.conversation_id === conversationId)?.counterpart_name).toBe("Eli Enquirer");

    const { data: peek } = await outsider.client.from("messages").select("id").eq("conversation_id", conversationId);
    expect(peek).toEqual([]);
    const { error: intrude } = await outsider.client.from("messages").insert({ conversation_id: conversationId, sender_id: outsider.id, body: "Hello?" });
    expect(intrude).not.toBeNull();
  });

  it("keeps enquiries text-only", async () => {
    const { error } = await buyer.client.from("messages").insert({
      conversation_id: conversationId,
      sender_id: buyer.id,
      message_type: "file",
      attachment_path: `${conversationId}/messages/brief.pdf`,
      attachment_name: "brief.pdf",
    });
    expect(error?.message).toMatch(/once an order is placed/);
  });

  it("notes the order in the enquiry when the buyer orders, without a notification", async () => {
    const countNotifications = async () =>
      (
        await service
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("type", "message_received")
          .eq("related_entity_id", conversationId)
      ).count;
    const before = await countNotifications();
    const { data: orderId, error } = await buyer.client.rpc("create_service_order", { p_service_id: specialist.serviceId, p_brief: "As discussed in chat: one carousel." });
    expect(error).toBeNull();
    const { data: order } = await service.from("orders").select("order_number").eq("id", orderId!).single();

    const { data: note } = await buyer.client
      .from("messages")
      .select("sender_id, message_type, body")
      .eq("conversation_id", conversationId)
      .eq("message_type", "system")
      .single();
    expect(note?.sender_id).toBeNull();
    expect(note?.body).toContain(order!.order_number);

    // The order still has its own conversation.
    const { data: orderConversation } = await service.from("conversations").select("kind").eq("order_id", orderId!).single();
    expect(orderConversation?.kind).toBe("order");
    expect(await countNotifications()).toBe(before);
  });

  it("limits how many new specialists a buyer can contact in a day", async () => {
    const busyBuyer = await createTestUser("buyer", "Busy Contacter");
    const people = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const { data } = await service.auth.admin.createUser({ email: `limit-${randomUUID()}@example.test`, password: randomUUID(), email_confirm: true });
        return data.user!.id;
      }),
    );
    const { error: seedError } = await service
      .from("conversations")
      .insert(people.map((id) => ({ kind: "enquiry", buyer_id: busyBuyer.id, specialist_id: id })));
    expect(seedError).toBeNull();
    const { error } = await busyBuyer.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id });
    expect(error?.message).toMatch(/try again tomorrow/);
  });

  it("removes a deleted account's enquiries", async () => {
    const leaver = await createTestUser("buyer", "Lee Leaver");
    const { data: enquiry } = await leaver.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id });
    // An order makes this an anonymisation rather than a full erase.
    await leaver.client.rpc("create_service_order", { p_service_id: specialist.serviceId, p_brief: "An order that will be cancelled." });
    const { data: result } = await leaver.client.rpc("delete_my_account", { p_confirmation: "Delete my Workido account" });
    expect(result).toBe("anonymised");
    const { count } = await service.from("conversations").select("id", { count: "exact", head: true }).eq("id", enquiry!);
    expect(count).toBe(0);
  });
});
