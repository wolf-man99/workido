import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, categoryId, createPublishedSpecialist, createTestUser, makeAdmin, type TestUser } from "../support/supabase";

describe("services and catalogue permissions", () => {
  let owner: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let other: Awaited<ReturnType<typeof createPublishedSpecialist>>;
  let buyer: TestUser;

  beforeAll(async () => {
    owner = await createPublishedSpecialist();
    other = await createPublishedSpecialist();
    buyer = await createTestUser("buyer", "Bea Buyer");
  });

  it("shows published services of published specialists publicly", async () => {
    const { data } = await anonClient().from("services").select("id").eq("id", owner.serviceId);
    expect(data).toHaveLength(1);
    const { data: search } = await anonClient().rpc("search_services", { p_specialist_id: owner.user.id });
    expect(search?.map((row) => row.service_id)).toContain(owner.serviceId);
  });

  it("hides unpublished services from the public", async () => {
    await owner.user.client.from("services").update({ publication_status: "unpublished" }).eq("id", owner.serviceId);
    const { data } = await anonClient().from("services").select("id").eq("id", owner.serviceId);
    expect(data).toEqual([]);
    await owner.user.client.from("services").update({ publication_status: "published" }).eq("id", owner.serviceId);
  });

  it("prevents a specialist from modifying another specialist's service", async () => {
    const { data } = await other.user.client.from("services").update({ price_minor: 10000 }).eq("id", owner.serviceId).select();
    expect(data).toEqual([]);
    const { data: deleted } = await other.user.client.from("services").delete().eq("id", owner.serviceId).select();
    expect(deleted).toEqual([]);
    const { error } = await other.user.client.from("services").insert({
      specialist_id: owner.user.id,
      category_id: await categoryId(),
      title: "Impersonated listing",
      description: "This should never be created on someone else's behalf.",
      deliverables: "Nothing",
      price_minor: 50000,
      delivery_time_hours: 24,
    });
    expect(error).not.toBeNull();
  });

  it("prevents buyers without the specialist role from listing services", async () => {
    const { error } = await buyer.client.from("services").insert({
      specialist_id: buyer.id,
      category_id: await categoryId(),
      title: "Buyer listing attempt",
      description: "Buyers do not have a specialist profile so this must fail.",
      deliverables: "Nothing",
      price_minor: 50000,
      delivery_time_hours: 24,
    });
    expect(error).not.toBeNull();
  });

  it("does not let owners self-moderate (remove/restore) listings", async () => {
    const { error } = await owner.user.client.from("services").update({ publication_status: "removed" }).eq("id", owner.serviceId);
    expect(error?.code).toBe("42501");
  });

  it("lets admins remove a listing, after which the owner cannot republish it", async () => {
    const admin = await createTestUser("buyer", "Mod Erator");
    await makeAdmin(admin);
    const { error } = await admin.client.rpc("admin_moderate_service", {
      p_service_id: other.serviceId,
      p_remove: true,
      p_reason: "Misleading claims",
    });
    expect(error).toBeNull();
    const { error: republish } = await other.user.client.from("services").update({ publication_status: "published" }).eq("id", other.serviceId);
    expect(republish?.code).toBe("42501");
  });

  it("only lets admins manage categories", async () => {
    const { error } = await buyer.client.from("categories").insert({ name: "Hacking", slug: "hacking" });
    expect(error).not.toBeNull();
  });
});
