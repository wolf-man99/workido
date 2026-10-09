import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, signUp, uniqueEmail } from "./helpers";

/**
 * Authentication: registration, logout, login, protected routes and
 * password recovery. Recovery reads the email from the local stack's
 * Mailpit inbox, so it only runs against `npm run db:start`.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: "Open account menu" }).click();
}

async function latestEmailLink(page: Page, email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await page.request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:"${email}"`, limit: 1 } });
        if (!search.ok()) return undefined;
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        if (!messages.length) return undefined;
        const message = await page.request.get(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
        const { Text } = (await message.json()) as { Text: string };
        link = Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/)?.[0];
        return link;
      },
      { timeout: 20_000, message: `waiting for an auth email to ${email}` },
    )
    .toBeTruthy();
  return link!;
}

test.describe("authentication", () => {
  test("logging out ends the session and protected pages ask to log in again", async ({ page }) => {
    const email = uniqueEmail("auth-cycle");
    await signUp(page, { name: "Lena Logout", email, role: "buyer" });

    await openAccountMenu(page);
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();

    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fsettings/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Wrong-password-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    // Returns to the page that was originally requested.
    await page.waitForURL("**/dashboard/settings");
  });

  test("a user can reset a forgotten password from the emailed link", async ({ page }) => {
    const reachable = await page.request.get(`${MAILPIT_URL}/api/v1/info`).then((response) => response.ok()).catch(() => false);
    test.skip(!reachable, "Needs the local Supabase mail catcher (npm run db:start)");

    const email = uniqueEmail("auth-reset");
    await signUp(page, { name: "Rhea Reset", email, role: "buyer" });
    await page.context().clearCookies();

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists for that email, a reset link is on its way.")).toBeVisible();

    await page.goto(await latestEmailLink(page, email));
    await page.waitForURL("**/reset-password");

    const newPassword = "Brand-new-pass-42";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await page.waitForURL("**/dashboard/**");

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/dashboard/**");
  });
});
