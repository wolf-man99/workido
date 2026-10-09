import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { config } from "dotenv";
import { logOut, signUp, uniqueEmail } from "./helpers";

config({ path: ".env.local", quiet: true });

/** Journey 9: unauthorised users are denied access to private data. */
test.describe("access control", () => {
  test("signed-out visitors are sent to log in", async ({ page }) => {
    await page.goto("/dashboard/buyer");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fbuyer/);
    await page.goto("/dashboard/orders/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/);
  });

  test("non-admins get a 404 for the admin area", async ({ page }) => {
    await signUp(page, { name: "Curious Buyer", email: uniqueEmail("curious"), role: "buyer" });
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });

  test("a buyer cannot open another buyer's order or files", async ({ page }) => {
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: order } = await service.from("orders").select("id, title, order_number").limit(1).maybeSingle();
    test.skip(!order, "Needs at least one order (run the seed or the marketplace spec first)");

    await logOut(page);
    await signUp(page, { name: "Nosy Buyer", email: uniqueEmail("nosy"), role: "buyer" });
    // The dashboard streams (loading.tsx), so the not-found page may arrive
    // with a 200 status; what matters is that no order data is rendered.
    await page.goto(`/dashboard/orders/${order!.id}`);
    await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
    await expect(page.getByText(order!.order_number)).toHaveCount(0);
    await expect(page.getByText(order!.title)).toHaveCount(0);

    const { data: deliverable } = await service.from("order_deliverables").select("storage_path, filename").not("storage_path", "is", null).limit(1).maybeSingle();
    if (deliverable?.storage_path) {
      const fileResponse = await page.request.get(`/api/files?bucket=order-files&path=${encodeURIComponent(deliverable.storage_path)}&name=x`, { maxRedirects: 0 });
      expect(fileResponse.status()).toBe(404);
    }
  });
});
