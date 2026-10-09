import { expect, test } from "@playwright/test";
import { createPublishedSpecialist, createTestUser, makeAdmin, markOrderPaid } from "../support/supabase";
import { expectToast } from "./helpers";

const ADMIN_PASSWORD = "Test-password-123";

test.describe.configure({ mode: "serial" });

test("admin approves a verification request, resolves a dispute and processes the refund", async ({ page }) => {
  // Arrange through the API (same RLS-enforced paths the app uses).
  const gig = await createPublishedSpecialist();
  await gig.user.client.from("portfolio_items").insert({ specialist_id: gig.user.id, title: "Brand launch", external_url: "https://example.com/work" });
  const { error: verificationError } = await gig.user.client.rpc("submit_verification_request", { p_note: "Please review my portfolio." });
  expect(verificationError).toBeNull();
  const { data: specialistProfile } = await gig.user.client.from("profiles").select("full_name, username").eq("id", gig.user.id).single();

  const buyer = await createTestUser("buyer", "Dana Dispute");
  const { data: orderId } = await buyer.client.rpc("create_service_order", { p_service_id: gig.serviceId, p_brief: "Need a launch carousel for next week." });
  await markOrderPaid(orderId!);
  await gig.user.client.rpc("perform_order_action", { p_order_id: orderId!, p_action: "accept" });
  await buyer.client.rpc("open_dispute", { p_order_id: orderId!, p_reason: "no_response", p_description: "No updates for several days after the specialist accepted." });

  const admin = await createTestUser("buyer", "Avery Admin");
  await makeAdmin(admin);

  // Log in as the admin through the UI.
  await page.goto("/login");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard/**");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Platform health" })).toBeVisible();
  await expect(page.getByText("Gross transaction value")).toBeVisible();

  // Verification: approve the request.
  await page.goto("/admin/verification");
  const request = page.locator("li").filter({ has: page.getByRole("link", { name: specialistProfile!.full_name }) });
  await request.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expectToast(page, "Specialist verified");
  await page.goto(`/specialists/${specialistProfile!.username}`);
  await expect(page.getByText("Verified").first()).toBeVisible();

  // Dispute: refund the buyer.
  await page.goto(`/admin/orders/${orderId}`);
  await page.getByLabel("Decision").selectOption("refund_buyer");
  await page.getByLabel("Resolution notes").fill("Specialist did not respond after accepting; refunding the buyer in full.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expectToast(page, "Dispute resolved");

  // Refund is executed through the (development) payment provider.
  await page.getByRole("button", { name: "Process refund" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Process refund" }).click();
  await expectToast(page, "Refund confirmed by the provider");
  await expect(page.getByText("Refunded").first()).toBeVisible();
});
