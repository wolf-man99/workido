import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, makeAdmin, service, type TestUser } from "../support/supabase";

describe("accounts, roles and profile protection", () => {
  let alice: TestUser;
  let bob: TestUser;
  let specialist: TestUser;

  beforeAll(async () => {
    alice = await createTestUser("buyer", "Alice Buyer");
    bob = await createTestUser("buyer", "Bob Buyer");
    specialist = await createTestUser("specialist", "Sam Specialist");
  });

  it("bootstraps a profile, settings and the requested role on sign-up", async () => {
    const { data: profile } = await alice.client.from("profiles").select("username, full_name, account_status").eq("id", alice.id).single();
    expect(profile?.full_name).toBe("Alice Buyer");
    expect(profile?.account_status).toBe("active");
    const { data: roles } = await alice.client.from("user_roles").select("role").eq("user_id", alice.id);
    expect(roles?.map((r) => r.role)).toEqual(["buyer"]);
    const { data: specialistProfile } = await specialist.client.from("specialist_profiles").select("user_id").eq("user_id", specialist.id).single();
    expect(specialistProfile?.user_id).toBe(specialist.id);
  });

  it("never grants admin from sign-up metadata", async () => {
    const { data, error } = await service.auth.admin.createUser({
      email: `sneaky-${Date.now()}@example.test`,
      password: "Test-password-123",
      email_confirm: true,
      user_metadata: { full_name: "Sneaky", initial_role: "admin" },
    });
    expect(error).toBeNull();
    const { data: roles } = await service.from("user_roles").select("role").eq("user_id", data.user!.id);
    expect(roles?.map((r) => r.role)).toEqual(["buyer"]);
  });

  it("prevents users from assigning themselves admin", async () => {
    const { error } = await alice.client.from("user_roles").insert({ user_id: alice.id, role: "admin" });
    expect(error).not.toBeNull();
    const { data: isAdmin } = await alice.client.rpc("is_admin");
    expect(isAdmin).toBe(false);
  });

  it("lets users add the specialist capability to themselves only", async () => {
    const { error: own } = await alice.client.rpc("become_specialist");
    expect(own).toBeNull();
    const { error: other } = await alice.client.from("user_roles").insert({ user_id: bob.id, role: "specialist" });
    expect(other).not.toBeNull();
  });

  it("prevents editing another user's profile", async () => {
    const { data } = await alice.client.from("profiles").update({ full_name: "Hacked" }).eq("id", bob.id).select();
    expect(data).toEqual([]);
    const { data: bobProfile } = await service.from("profiles").select("full_name").eq("id", bob.id).single();
    expect(bobProfile?.full_name).toBe("Bob Buyer");
  });

  it("prevents users from changing their own account status", async () => {
    const { error } = await alice.client.from("profiles").update({ account_status: "suspended" }).eq("id", alice.id);
    expect(error?.code).toBe("42501");
  });

  it("prevents specialists from changing their own verification status or reputation", async () => {
    const { error: verification } = await specialist.client
      .from("specialist_profiles")
      .update({ verification_status: "verified" })
      .eq("user_id", specialist.id);
    expect(verification?.code).toBe("42501");
    const { error: rating } = await specialist.client
      .from("specialist_profiles")
      .update({ rating_avg: 5, rating_count: 100 })
      .eq("user_id", specialist.id);
    expect(rating?.code).toBe("42501");
  });

  it("requires a complete profile before publishing", async () => {
    const { error } = await specialist.client.from("specialist_profiles").update({ is_published: true }).eq("user_id", specialist.id);
    expect(error?.message).toMatch(/headline/i);
  });

  it("keeps contact settings private", async () => {
    const { data: own } = await alice.client.from("user_settings").select("user_id").eq("user_id", alice.id);
    expect(own).toHaveLength(1);
    const { data: other } = await alice.client.from("user_settings").select("user_id").eq("user_id", bob.id);
    expect(other).toEqual([]);
    const { data: anon } = await anonClient().from("user_settings").select("user_id");
    expect(anon).toEqual([]);
  });

  it("blocks non-admins from admin functions", async () => {
    const { error: metrics } = await alice.client.rpc("admin_platform_metrics");
    expect(metrics?.code).toBe("42501");
    const { error: suspend } = await alice.client.rpc("admin_set_account_status", {
      p_user_id: bob.id,
      p_status: "suspended",
      p_reason: "testing",
    });
    expect(suspend?.code).toBe("42501");
    const { error: anon } = await anonClient().rpc("admin_platform_metrics");
    expect(anon).not.toBeNull();
  });

  it("lets admins suspend accounts, which hides them publicly", async () => {
    const admin = await createTestUser("buyer", "Ada Admin");
    await makeAdmin(admin);
    const { error } = await admin.client.rpc("admin_set_account_status", {
      p_user_id: bob.id,
      p_status: "suspended",
      p_reason: "Reported for spam",
    });
    expect(error).toBeNull();
    const { data: visible } = await anonClient().from("profiles").select("id").eq("id", bob.id);
    expect(visible).toEqual([]);
    const { data: audit } = await service.from("admin_actions").select("action").eq("target_id", bob.id);
    expect(audit?.map((a) => a.action)).toContain("suspend_user");
    // Suspended users cannot create requirements.
    const { error: blocked } = await bob.client.from("requirements").insert({ buyer_id: bob.id, title: "Should fail" });
    expect(blocked).not.toBeNull();
    const { error: selfReview } = await admin.client.rpc("admin_set_account_status", {
      p_user_id: admin.id,
      p_status: "suspended",
      p_reason: "self",
    });
    expect(selfReview?.message).toMatch(/own account/);
  });
});
