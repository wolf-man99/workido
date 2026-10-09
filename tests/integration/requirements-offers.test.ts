import { beforeAll, describe, expect, it } from "vitest";
import { categoryId, createPublishedSpecialist, createTestUser, service, skillId, type TestUser } from "../support/supabase";

async function createOpenRequirement(buyer: TestUser) {
  const { data, error } = await buyer.client
    .from("requirements")
    .insert({
      buyer_id: buyer.id,
      title: "Carousel for product launch",
      description: "Need an 8-slide Instagram carousel announcing our new product line.",
      category_id: await categoryId(),
      budget_max_minor: 200000,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("requirements, invitations and offers", () => {
  let buyer: TestUser;
  let otherBuyer: TestUser;
  let specialist: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let secondSpecialist: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let outsider: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let requirementId: string;

  beforeAll(async () => {
    buyer = await createTestUser("buyer", "Rita Requester");
    otherBuyer = await createTestUser("buyer", "Otto Other");
    specialist = await createPublishedSpecialist();
    secondSpecialist = await createPublishedSpecialist();
    outsider = await createPublishedSpecialist();
    requirementId = await createOpenRequirement(buyer);
  });

  it("validates required fields before a requirement can be opened", async () => {
    const { error } = await buyer.client.from("requirements").insert({ buyer_id: buyer.id, title: "Too short", status: "open" });
    expect(error?.code).toBe("23514");
    const { error: draftError } = await buyer.client.from("requirements").insert({ buyer_id: buyer.id, title: "A draft", status: "draft" });
    expect(draftError).toBeNull();
  });

  it("keeps requirements private to their owner", async () => {
    const { data } = await otherBuyer.client.from("requirements").select("id").eq("id", requirementId);
    expect(data).toEqual([]);
    const { data: updated } = await otherBuyer.client.from("requirements").update({ title: "Hijacked title here" }).eq("id", requirementId).select();
    expect(updated).toEqual([]);
    const { data: specialistView } = await specialist.user.client.from("requirements").select("id").eq("id", requirementId);
    expect(specialistView).toEqual([]);
  });

  it("lets the owner edit their requirement and its draft", async () => {
    const { data: updated, error } = await buyer.client
      .from("requirements")
      .update({ budget_max_minor: 250000, title: "Carousel for our product launch" })
      .eq("id", requirementId)
      .select("title, budget_max_minor")
      .single();
    expect(error).toBeNull();
    expect(updated).toEqual({ title: "Carousel for our product launch", budget_max_minor: 250000 });

    const { data: draft } = await buyer.client.from("requirements").insert({ buyer_id: buyer.id, title: "Draft to finish later", status: "draft" }).select("id").single();
    const { error: openTooEarly } = await buyer.client.from("requirements").update({ status: "open" }).eq("id", draft!.id);
    expect(openTooEarly?.code).toBe("23514");
    const { error: deleteDraft } = await buyer.client.from("requirements").delete().eq("id", draft!.id);
    expect(deleteDraft).toBeNull();
  });

  it("does not let buyers mark a requirement hired directly", async () => {
    const { error } = await buyer.client.from("requirements").update({ status: "hired" }).eq("id", requirementId);
    expect(error).not.toBeNull();
  });

  it("returns match candidates only to the requirement owner", async () => {
    await buyer.client.from("requirement_skills").insert({ requirement_id: requirementId, skill_id: await skillId("canva") });
    const { data, error } = await buyer.client.rpc("get_match_candidates", { p_requirement_id: requirementId });
    expect(error).toBeNull();
    expect(data?.map((c) => c.specialist_id)).toContain(specialist.user.id);
    const { error: denied } = await otherBuyer.client.rpc("get_match_candidates", { p_requirement_id: requirementId });
    expect(denied?.code).toBe("P0002");
  });

  it("lets invited specialists see the requirement and submit one offer", async () => {
    for (const s of [specialist, secondSpecialist]) {
      const { error } = await buyer.client.from("requirement_invitations").insert({ requirement_id: requirementId, specialist_id: s.user.id });
      expect(error).toBeNull();
    }
    const { data: visible } = await specialist.user.client.from("requirements").select("id, title").eq("id", requirementId);
    expect(visible).toHaveLength(1);

    const offer = {
      requirement_id: requirementId,
      specialist_id: specialist.user.id,
      proposed_price_minor: 180000,
      delivery_time_hours: 72,
      revisions_included: 2,
      message: "Happy to help - I have designed many launch carousels for D2C brands.",
    };
    const { error } = await specialist.user.client.from("offers").insert(offer);
    expect(error).toBeNull();
    const { error: duplicate } = await specialist.user.client.from("offers").insert(offer);
    expect(duplicate?.code).toBe("23505");

    const { error: second } = await secondSpecialist.user.client.from("offers").insert({ ...offer, specialist_id: secondSpecialist.user.id, proposed_price_minor: 160000 });
    expect(second).toBeNull();

    const { data: notifications } = await service.from("notifications").select("type").eq("user_id", buyer.id);
    expect(notifications?.map((n) => n.type)).toContain("offer_received");
  });

  it("rejects offers from specialists who were not invited", async () => {
    const { error } = await outsider.user.client.from("offers").insert({
      requirement_id: requirementId,
      specialist_id: outsider.user.id,
      proposed_price_minor: 100000,
      delivery_time_hours: 24,
      message: "I was not invited but would like to bid anyway on this one.",
    });
    expect(error).not.toBeNull();
  });

  it("converts an accepted offer into an order and closes the rest", async () => {
    const { data: offers } = await buyer.client.from("offers").select("id, specialist_id").eq("requirement_id", requirementId);
    const chosen = offers!.find((o) => o.specialist_id === specialist.user.id)!;
    const { data: orderId, error } = await buyer.client.rpc("accept_offer", { p_offer_id: chosen.id });
    expect(error).toBeNull();

    const { data: order } = await buyer.client.from("orders").select("status, price_minor, source, revisions_included, specialist_id").eq("id", orderId!).single();
    expect(order).toMatchObject({ status: "pending_payment", price_minor: 180000, source: "offer", revisions_included: 2, specialist_id: specialist.user.id });

    const { data: after } = await buyer.client.from("offers").select("specialist_id, status").eq("requirement_id", requirementId);
    expect(after?.find((o) => o.specialist_id === secondSpecialist.user.id)?.status).toBe("declined");
    const { data: req } = await buyer.client.from("requirements").select("status").eq("id", requirementId).single();
    expect(req?.status).toBe("hired");

    const { error: again } = await buyer.client.rpc("accept_offer", { p_offer_id: chosen.id });
    expect(again).not.toBeNull();
  });

  it("does not let another buyer accept someone else's offer", async () => {
    const reqId = await createOpenRequirement(buyer);
    await buyer.client.from("requirement_invitations").insert({ requirement_id: reqId, specialist_id: secondSpecialist.user.id });
    const { data: offer } = await secondSpecialist.user.client
      .from("offers")
      .insert({
        requirement_id: reqId,
        specialist_id: secondSpecialist.user.id,
        proposed_price_minor: 120000,
        delivery_time_hours: 48,
        message: "I can turn this around in two days with one revision included.",
      })
      .select("id")
      .single();
    const { error } = await otherBuyer.client.rpc("accept_offer", { p_offer_id: offer!.id });
    expect(error?.code).toBe("P0002");
  });
});
