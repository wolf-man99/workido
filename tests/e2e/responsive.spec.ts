import { expect, test } from "@playwright/test";

/** Runs in the "mobile" project (Pixel 7 viewport). */
const PAGES = ["/", "/gigs", "/specialists", "/categories", "/how-it-works", "/login", "/signup", "/contact"];

test.describe("mobile layout", () => {
  for (const path of PAGES) {
    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("navigation works through the mobile menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Explore gigs" }).click();
    await expect(page).toHaveURL(/\/gigs/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("gig filters are collapsible on small screens", async ({ page }) => {
    await page.goto("/gigs");
    const toggle = page.getByRole("button", { name: /Filters/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("Search")).toBeHidden();
    await toggle.click();
    await expect(page.getByLabel("Search")).toBeVisible();
  });
});
