import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const PASSWORD = "E2e-password-123";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}@e2e.workido.test`;
}

/** Signs up through the UI. Local Supabase has email confirmation disabled. */
export async function signUp(page: Page, { name, email, role }: { name: string; email: string; role: "buyer" | "specialist" }) {
  await page.goto(`/signup${role === "specialist" ? "?role=specialist" : ""}`);
  await page.getByText(role === "specialist" ? "I want to work" : "I want to hire").click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(role === "specialist" ? "**/dashboard/specialist/profile" : "**/dashboard/buyer");
}

export async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard/**");
}

export async function logOut(page: Page) {
  await page.context().clearCookies();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

/** A tiny valid PNG for upload tests. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
