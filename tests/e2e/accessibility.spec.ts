import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

/**
 * Automated WCAG 2.1 A/AA checks with axe-core. Automated checks catch a
 * subset of issues; manual keyboard and screen-reader testing is still
 * needed before launch (see docs/TESTING.md).
 */
const PUBLIC_PAGES = ["/", "/gigs", "/specialists", "/categories", "/how-it-works", "/login", "/signup", "/contact", "/terms"];

async function audit(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("nextjs-portal").analyze();
  const summary = results.violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.length} node(s) — ${violation.help}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const path of PUBLIC_PAGES) {
  test(`${path} has no detectable WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await audit(page);
  });
}

test("dashboard pages have no detectable WCAG A/AA violations", async ({ page }) => {
  await signUp(page, { name: "Ally Buyer", email: uniqueEmail("a11y"), role: "buyer" });
  for (const path of ["/dashboard/buyer", "/dashboard/buyer/requirements/new", "/dashboard/settings", "/dashboard/notifications"]) {
    await page.goto(path);
    await audit(page);
  }
});
