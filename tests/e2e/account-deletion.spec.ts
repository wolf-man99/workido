import { expect, test, type Page } from "@playwright/test";
import { createPublishedSpecialist, createTestUser, markOrderPaid } from "../support/supabase";
import { PASSWORD, signUp, uniqueEmail } from "./helpers";

const PHRASE = "Delete my Workido account";

async function openDeleteDialog(page: Page) {
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Delete account" }).click();
  return page.getByRole("dialog", { name: "Delete your Workido account?" });
}

test.describe("account deletion", () => {
  for (const role of ["buyer", "specialist"] as const) {
    test(`a ${role} deletes their account after typing the confirmation sentence`, async ({ page }) => {
      const email = uniqueEmail(`delete-${role}`);
      await signUp(page, { name: role === "buyer" ? "Hana Hirer" : "Wes Worker", email, role });

      const dialog = await openDeleteDialog(page);
      const input = dialog.getByLabel(`To confirm, type "${PHRASE}"`);
      const confirm = dialog.getByRole("button", { name: "Delete my account" });
      await expect(confirm).toBeDisabled();
      await input.fill("delete my workido account");
      await expect(confirm).toBeDisabled();
      await input.fill(PHRASE);
      await expect(confirm).toBeEnabled();
      await confirm.click();

      await page.waitForURL("**/account-deleted");
      await expect(page.getByRole("heading", { name: "Hoping to see you again" })).toBeVisible();

      // Logged out, and the old password no longer works.
      await page.goto("/dashboard/settings");
      await expect(page).toHaveURL(/\/login/);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    });
  }

  test("explains why deletion has to wait while an order is in progress", async ({ page }) => {
    const specialist = await createPublishedSpecialist();
    const buyer = await createTestUser("buyer", "Busy Buyer");
    const { data: orderId } = await buyer.client.rpc("create_service_order", {
      p_service_id: specialist.serviceId,
      p_brief: "Carousel for our launch next week, please.",
    });
    await markOrderPaid(orderId!);
    await specialist.user.client.rpc("perform_order_action", { p_order_id: orderId!, p_action: "accept" });

    await page.goto("/login");
    await page.getByLabel("Email").fill(buyer.email);
    await page.getByLabel("Password").fill("Test-password-123");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/dashboard/**");

    const dialog = await openDeleteDialog(page);
    await expect(dialog.getByText("You have orders in progress.", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(`To confirm, type "${PHRASE}"`)).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Delete my account" })).toBeDisabled();
  });
});
