import { describe, expect, it } from "vitest";
import {
  addLinkDeliverable,
  anonClient,
  createPublishedSpecialist,
  createTestUser,
  makeAdmin,
  markOrderPaid,
  service,
  type TestUser,
} from "../support/supabase";

const PHRASE = "Delete my Workido account";
const PASSWORD = "Test-password-123";

async function canSignIn(email: string) {
  const { error } = await anonClient().auth.signInWithPassword({ email, password: PASSWORD });
  return !error;
}

async function deleteAccount(user: TestUser) {
  return user.client.rpc("delete_my_account", { p_confirmation: PHRASE });
}

describe("account deletion", () => {
  it("requires the exact confirmation sentence", async () => {
    const user = await createTestUser("buyer", "Careful Buyer");
    const { error } = await user.client.rpc("delete_my_account", { p_confirmation: "delete my account" });
    expect(error?.code).toBe("22023");
    expect(await canSignIn(user.email)).toBe(true);
  });

  it("is not available to anonymous visitors", async () => {
    const { error } = await anonClient().rpc("delete_my_account", { p_confirmation: PHRASE });
    expect(error).not.toBeNull();
  });

  it("erases buyers and specialists without order history completely", async () => {
    const buyer = await createTestUser("buyer", "Brief Buyer");
    await buyer.client.from("requirements").insert({ buyer_id: buyer.id, title: "A draft task", status: "draft" });
    const specialist = await createPublishedSpecialist();

    for (const user of [buyer, specialist.user]) {
      const { data, error } = await deleteAccount(user);
      expect(error).toBeNull();
      expect(data).toBe("deleted");
      const { data: authUser } = await service.auth.admin.getUserById(user.id);
      expect(authUser.user).toBeNull();
      expect(await canSignIn(user.email)).toBe(false);
    }

    const { count: services } = await service.from("services").select("id", { count: "exact", head: true }).eq("id", specialist.serviceId);
    expect(services).toBe(0);
    const { count: requirements } = await service.from("requirements").select("id", { count: "exact", head: true }).eq("buyer_id", buyer.id);
    expect(requirements).toBe(0);
  });

  it("waits for active orders and payouts, then anonymises and keeps the order history", async () => {
    const specialist = await createPublishedSpecialist();
    const buyer = await createTestUser("buyer", "Olivia Order");
    const { data: orderId } = await buyer.client.rpc("create_service_order", {
      p_service_id: specialist.serviceId,
      p_brief: "Need a carousel for our launch next week.",
    });
    await markOrderPaid(orderId!);
    await specialist.user.client.rpc("perform_order_action", { p_order_id: orderId!, p_action: "accept" });

    for (const user of [buyer, specialist.user]) {
      const { data: blocker } = await user.client.rpc("account_deletion_blocker");
      expect(blocker).toMatch(/orders in progress/);
      const { error } = await deleteAccount(user);
      expect(error?.code).toBe("23514");
    }

    await addLinkDeliverable(specialist.user, orderId!);
    await specialist.user.client.rpc("perform_order_action", { p_order_id: orderId!, p_action: "submit", p_note: "Here is the final carousel." });
    await buyer.client.rpc("perform_order_action", { p_order_id: orderId!, p_action: "approve" });
    await buyer.client.from("reviews").insert({ order_id: orderId!, reviewer_id: buyer.id, reviewee_id: specialist.user.id, rating: 5, comment: "Great work" });

    // The specialist is still owed the payout.
    const { data: payoutBlocker } = await specialist.user.client.rpc("account_deletion_blocker");
    expect(payoutBlocker).toMatch(/payout/);

    // The buyer can leave: anonymised, because the order must stay.
    const { data, error } = await deleteAccount(buyer);
    expect(error).toBeNull();
    expect(data).toBe("anonymised");
    expect(await canSignIn(buyer.email)).toBe(false);

    const { data: order } = await specialist.user.client
      .from("orders")
      .select("status, buyer:profiles!orders_buyer_id_fkey(full_name)")
      .eq("id", orderId!)
      .single();
    expect(order?.status).toBe("completed");
    expect(order?.buyer?.full_name).toBe("Deleted user");
    const { data: profile } = await service.from("profiles").select("account_status, bio, city, avatar_path").eq("id", buyer.id).single();
    expect(profile).toEqual({ account_status: "deleted", bio: null, city: null, avatar_path: null });
    const { count: reviews } = await service.from("reviews").select("id", { count: "exact", head: true }).eq("order_id", orderId!);
    expect(reviews).toBe(1);

    // The old session can't act any more, and the email can be used again.
    const { error: staleSession } = await buyer.client.rpc("create_service_order", { p_service_id: specialist.serviceId, p_brief: "Trying again after deletion." });
    expect(staleSession).not.toBeNull();
    const { data: fresh, error: signUpError } = await service.auth.admin.createUser({ email: buyer.email, password: PASSWORD, email_confirm: true });
    expect(signUpError).toBeNull();
    expect(fresh.user?.id).not.toBe(buyer.id);

    // Once paid out, the specialist can delete too; their listing disappears.
    const admin = await createTestUser("buyer", "Payout Admin");
    await makeAdmin(admin);
    expect((await admin.client.rpc("admin_mark_payout", { p_order_id: orderId!, p_reference: "UTR-TEST-123" })).error).toBeNull();
    const { data: specialistResult, error: specialistError } = await deleteAccount(specialist.user);
    expect(specialistError).toBeNull();
    expect(specialistResult).toBe("anonymised");
    const { data: publicService } = await anonClient().from("services").select("id").eq("id", specialist.serviceId);
    expect(publicService).toEqual([]);
    const { data: specialistProfile } = await service.from("specialist_profiles").select("is_published, headline").eq("user_id", specialist.user.id).single();
    expect(specialistProfile).toEqual({ is_published: false, headline: null });
  });

  it("cancels unpaid orders so the other party isn't left waiting", async () => {
    const specialist = await createPublishedSpecialist();
    const buyer = await createTestUser("buyer", "Uma Unpaid");
    const { data: orderId } = await buyer.client.rpc("create_service_order", {
      p_service_id: specialist.serviceId,
      p_brief: "Checking prices for a carousel.",
    });
    const { data } = await deleteAccount(specialist.user);
    expect(data).toBe("anonymised");
    const { data: order } = await buyer.client.from("orders").select("status, cancellation_reason").eq("id", orderId!).single();
    expect(order).toEqual({ status: "cancelled", cancellation_reason: "The account was deleted." });
  });

  it("keeps admins from deleting themselves or reviving deleted accounts", async () => {
    const admin = await createTestUser("buyer", "Ada Admin");
    await makeAdmin(admin);
    const { error } = await deleteAccount(admin);
    expect(error?.message).toMatch(/Administrator accounts/);

    const specialist = await createPublishedSpecialist();
    const buyer = await createTestUser("buyer", "Gone Buyer");
    await buyer.client.rpc("create_service_order", { p_service_id: specialist.serviceId, p_brief: "An order that will be cancelled." });
    expect((await deleteAccount(buyer)).data).toBe("anonymised");
    const { error: reactivate } = await admin.client.rpc("admin_set_account_status", {
      p_user_id: buyer.id,
      p_status: "active",
      p_reason: "Trying to restore",
    });
    expect(reactivate?.message).toMatch(/Deleted accounts/);
  });
});
