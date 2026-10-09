import { expect, test, type Page } from "@playwright/test";
import { PNG, expectToast, logIn, logOut, signUp, uniqueEmail } from "./helpers";

/**
 * Critical journeys, run in order with shared accounts:
 *  2. A specialist creates a profile and publishes a service.
 *  1. A buyer registers and publishes a requirement.
 *  3. A buyer browses and purchases a predefined service.
 *  5/6. The specialist delivers, the buyer requests a revision, then approves.
 *  7. The completed order accepts exactly one review.
 *  8. The buyer starts a repeat hire.
 *  4. A buyer posts a custom requirement and selects an offer.
 */
test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const specialist = { name: `Sana Specialist ${runId}`, email: uniqueEmail("specialist"), username: "" };
const buyer = { name: `Bilal Buyer ${runId}`, email: uniqueEmail("buyer") };
const serviceTitle = `E2E carousel design ${runId}`;
let orderUrl = "";

async function asSpecialist(page: Page) {
  await logOut(page);
  await logIn(page, specialist.email);
}

async function asBuyer(page: Page) {
  await logOut(page);
  await logIn(page, buyer.email);
}

test("specialist creates a profile and publishes a service", async ({ page }) => {
  await signUp(page, { name: specialist.name, email: specialist.email, role: "specialist" });

  await page.getByLabel("Headline").fill("Social media designer for growing brands");
  await page.getByLabel("Professional bio").fill("I design Instagram carousels and social creatives for D2C brands, working from your brand kit and references.");
  await page.getByLabel("Experience level").selectOption("intermediate");
  await page.getByRole("group", { name: "Categories" }).getByRole("button", { name: "Graphic Design", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search skills" }).fill("canva");
  await page.getByRole("group", { name: "Skills" }).getByRole("button", { name: "Canva" }).click();
  await page.getByRole("searchbox", { name: "Search skills" }).fill("carousel");
  await page.getByRole("group", { name: "Skills" }).getByRole("button", { name: "Instagram carousels" }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expectToast(page, "Profile saved");

  await page.getByRole("button", { name: "Publish profile" }).click();
  await expectToast(page, "Your profile is live");

  // Upload a real portfolio image through the verified upload pipeline.
  await page.goto("/dashboard/specialist/portfolio");
  await page.getByLabel("Title").fill("Launch carousel");
  await page.locator('input[type="file"]').setInputFiles({ name: "carousel.png", mimeType: "image/png", buffer: PNG });
  await expectToast(page, "carousel.png uploaded");
  await expect(page.getByRole("img", { name: "Launch carousel" })).toBeVisible();

  await page.goto("/dashboard/specialist/services/new");
  await page.getByLabel("Service title").fill(serviceTitle);
  await page.getByLabel("Category").selectOption({ label: "Graphic Design" });
  await page.getByLabel("Description").fill("A polished Instagram carousel of up to eight slides designed around your brand guidelines.");
  await page.getByLabel("Deliverables").fill("Up to 8 slides as PNG plus source file");
  await page.getByLabel("Price (₹)").fill("1500");
  await page.getByLabel("Included revisions").selectOption("1");
  await page.getByRole("button", { name: "Save & publish" }).click();
  await page.waitForURL("**/dashboard/specialist/services");
  await expect(page.getByText(serviceTitle)).toBeVisible();

  const profileLink = page.getByRole("link", { name: "View public profile" });
  await page.goto("/dashboard/specialist");
  const href = await profileLink.getAttribute("href");
  specialist.username = href?.split("/").pop() ?? "";
  expect(specialist.username).not.toBe("");
});

test("buyer registers and publishes a requirement", async ({ page }) => {
  await logOut(page);
  await signUp(page, { name: buyer.name, email: buyer.email, role: "buyer" });

  await page.goto("/dashboard/buyer/requirements/new");
  await page.getByLabel("Task title").fill(`Festive carousel ${runId}`);
  await page.getByLabel("Detailed description").fill("We need an 8-slide Instagram carousel for our festive sale, following our brand kit.");
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Graphic Design" });
  await page.getByRole("searchbox", { name: "Search required skills" }).fill("canva");
  await page.getByRole("button", { name: "Canva" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2 validates the budget before continuing.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter your maximum budget")).toBeVisible();
  await page.getByLabel("Maximum budget (₹)").fill("3000");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Review your task" })).toBeVisible();
  await page.getByRole("button", { name: "Post task" }).click();
  await expect(page.getByRole("heading", { name: "Your task is live" })).toBeVisible();
  await page.getByRole("link", { name: "Review your matches" }).click();

  // The new specialist appears in the shortlist with an explanation.
  const card = page.locator("li").filter({ has: page.getByRole("link", { name: specialist.name }) });
  await expect(card).toBeVisible();
  await expect(card.getByText("Offers services in Graphic Design")).toBeVisible();
});

test("buyer purchases a gig, specialist delivers, buyer requests a revision and approves", async ({ page }) => {
  await asBuyer(page);
  await page.goto(`/gigs?q=${encodeURIComponent(serviceTitle)}`);
  await page.getByRole("link", { name: serviceTitle }).click();
  await page.getByLabel("Your requirements").fill("Diwali sale carousel. Brand colours: orange and ink. Copy attached in chat.");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.waitForURL("**/checkout");

  await expect(page.getByText("Test mode")).toBeVisible();
  await expect(page.getByText("₹1,500").first()).toBeVisible();
  await page.getByRole("button", { name: /Pay ₹1,500/ }).click();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await page.waitForURL(/\/dashboard\/orders\/[^/]+\?paid=1/);
  await expect(page.getByText("Payment verified").first()).toBeVisible();
  orderUrl = page.url().split("?")[0] ?? "";

  // Specialist accepts and delivers a file and a link.
  await asSpecialist(page);
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Accept & start work" }).click();
  await expectToast(page, "work has started");
  await page.locator('input[type="file"]').setInputFiles({ name: "slides.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("slides.png")).toBeVisible();
  await page.getByLabel("Delivery message").fill("First version attached — 8 slides.");
  await page.getByRole("button", { name: "Submit delivery" }).click();
  await expectToast(page, "Delivery submitted");

  // Buyer requests a revision (limited to the included revision).
  await asBuyer(page);
  await page.goto(orderUrl);
  await expect(page.getByRole("link", { name: /slides\.png/ })).toBeVisible();
  await page.getByRole("button", { name: /Request revision \(1 left\)/ }).click();
  await page.getByLabel("What needs to change?").fill("Please make the headline on slide 1 larger.");
  await page.getByRole("button", { name: "Send revision request" }).click();
  await expectToast(page, "Revision requested");

  // Specialist resubmits with a link.
  await asSpecialist(page);
  await page.goto(orderUrl);
  await expect(page.getByText("Please make the headline on slide 1 larger.").first()).toBeVisible();
  await page.getByLabel("Link URL").fill("https://example.com/final-carousel");
  await page.getByLabel("Link label").fill("Final carousel (Figma)");
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByText("Final carousel (Figma)")).toBeVisible();
  await page.getByLabel("What did you change?").fill("Headline enlarged on slide 1.");
  await page.getByRole("button", { name: "Submit revision" }).click();
  await expectToast(page, "Delivery submitted");

  // Buyer has no revisions left and approves.
  await asBuyer(page);
  await page.goto(orderUrl);
  await expect(page.getByText("All included revisions used.")).toBeVisible();
  await page.getByRole("button", { name: "Approve & complete" }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expectToast(page, "The order is complete");
  await expect(page.getByText("Completed").first()).toBeVisible();
});

test("a completed order accepts exactly one review, and the buyer can hire again", async ({ page }) => {
  await asBuyer(page);
  await page.goto(orderUrl);
  await page.locator("label").filter({ has: page.getByRole("radio", { name: "5 stars" }) }).click();
  await page.getByLabel("Your review").fill("Quick, friendly and exactly on brief.");
  await page.getByRole("button", { name: "Submit review" }).click();
  await expectToast(page, "Thanks for your review");
  await expect(page.getByRole("heading", { name: "Your review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit review" })).toHaveCount(0);

  // The rating now shows publicly, derived from the real review.
  await page.goto(`/specialists/${specialist.username}`);
  await expect(page.getByText("Quick, friendly and exactly on brief.")).toBeVisible();

  // Repeat hire pre-invites the same specialist.
  await page.goto(orderUrl);
  await page.getByRole("link", { name: "Hire again" }).click();
  await expect(page.getByText(`${specialist.name} will be invited to this task automatically`)).toBeVisible();
});

test("buyer posts a custom requirement and accepts an offer", async ({ page }) => {
  await asBuyer(page);
  await page.goto("/dashboard/buyer/requirements");
  await page.getByRole("link", { name: new RegExp(`Festive carousel ${runId}`) }).click();
  const card = page.locator("li").filter({ has: page.getByRole("link", { name: specialist.name }) });
  await card.getByRole("button", { name: "Invite" }).click();
  await expectToast(page, "Invitation sent");
  const requirementUrl = page.url();

  await asSpecialist(page);
  await page.goto("/dashboard/specialist/opportunities");
  await page.getByRole("link", { name: new RegExp(`Festive carousel ${runId}`) }).click();
  await page.getByLabel("Your price (₹)").fill("2800");
  await page.getByLabel("Message to the buyer").fill("Happy to help — I can deliver all slides in three days with one revision.");
  await page.getByRole("button", { name: "Send offer" }).click();
  await expectToast(page, "Offer sent");

  await asBuyer(page);
  await page.goto(requirementUrl);
  await expect(page.getByText("₹2,800")).toBeVisible();
  await page.getByRole("button", { name: "Accept offer" }).click();
  await page.getByRole("button", { name: "Accept & continue to payment" }).click();
  await page.waitForURL("**/checkout");
  await expect(page.getByText("₹2,800").first()).toBeVisible();
});
