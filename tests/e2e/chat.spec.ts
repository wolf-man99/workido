import { expect, test, type Browser, type Page } from "@playwright/test";
import { createPublishedSpecialist, createTestUser } from "../support/supabase";
import { PNG } from "./helpers";

/**
 * Pre-order chat: the contact-detail reminder, images, voice notes (with a
 * simulated microphone), replies, and a proposal negotiated with one
 * counter-offer that ends at checkout.
 */
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

async function loginAs(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ permissions: ["microphone"] });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Test-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard/**");
  return page;
}

test("buyer and specialist chat with files, voice and replies, then agree a proposal after one counter-offer", async ({ browser }) => {
  // One long journey across two people.
  test.setTimeout(240_000);
  const specialist = await createPublishedSpecialist({ price: 200000 });
  const buyer = await createTestUser("buyer", "Bea Buyer");
  const { data: conversationId } = await buyer.client.rpc("start_enquiry", { p_specialist_id: specialist.user.id, p_service_id: specialist.serviceId });
  const chatUrl = `/dashboard/messages/${conversationId}`;

  // Buyer: the contact-detail reminder, then a normal message.
  const buyerPage = await loginAs(browser, buyer.email);
  await buyerPage.goto(chatUrl);
  await expect(buyerPage.getByText("Agree the details here and pay on Workido.")).toBeVisible();
  const box = buyerPage.getByRole("textbox", { name: "Message" });
  await box.fill("Call me on 98765 43210 and we can sort it out");
  await buyerPage.getByRole("button", { name: "Send message" }).click();
  await expect(buyerPage.getByText("Sharing contact or payment details?")).toBeVisible();
  await buyerPage.getByRole("button", { name: "Edit message" }).click();
  await box.fill("Hi! Can you add story-sized versions as well?");
  await buyerPage.getByRole("button", { name: "Send message" }).click();
  await expect(buyerPage.getByText("Can you add story-sized versions")).toBeVisible();

  // An image before ordering.
  await buyerPage.getByRole("button", { name: "Attach a file" }).click();
  await buyerPage.locator('input[type="file"]').setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: PNG });
  await expect(buyerPage.getByRole("img", { name: "reference.png" })).toBeVisible();

  // A voice note from the simulated microphone.
  await buyerPage.getByRole("button", { name: "Record a voice note" }).click();
  await expect(buyerPage.getByText(/Recording \d:\d\d/)).toBeVisible();
  await buyerPage.waitForTimeout(1500);
  await buyerPage.getByRole("button", { name: "Stop recording" }).click();
  await buyerPage.getByRole("button", { name: "Send voice note" }).click();
  await expect(buyerPage.getByLabel("Voice note from you")).toBeVisible();

  // Specialist: reply to a specific message, then send a proposal.
  const specialistPage = await loginAs(browser, specialist.user.email);
  await specialistPage.goto(chatUrl);
  await expect(specialistPage.getByLabel("Voice note from Bea Buyer")).toBeVisible();
  const question = specialistPage.locator("li").filter({ hasText: "Can you add story-sized versions" });
  await question.getByRole("button", { name: /Reply to Bea Buyer's message/ }).click();
  await expect(specialistPage.getByText("Replying to Bea Buyer")).toBeVisible();
  await specialistPage.getByRole("textbox", { name: "Message" }).fill("Yes! I'll send you a proposal now.");
  await specialistPage.getByRole("button", { name: "Send message" }).click();
  const reply = specialistPage.locator("li").filter({ hasText: "I'll send you a proposal now." }).last();
  await expect(reply.getByText("Can you add story-sized versions")).toBeVisible();

  await specialistPage.getByRole("button", { name: "Send a proposal" }).click();
  const proposalForm = specialistPage.getByRole("dialog", { name: "Send a proposal" });
  await proposalForm.getByLabel("Title").fill("Carousel plus story versions");
  await proposalForm.getByLabel("Price (₹)").fill("2,600");
  await proposalForm.getByLabel("Delivery time").fill("4");
  await proposalForm.getByLabel("Delivery unit").selectOption("days");
  await proposalForm.getByRole("button", { name: "Send proposal" }).click();
  await expect(specialistPage.getByRole("article", { name: "Proposal: Carousel plus story versions" })).toBeVisible();

  // Buyer: one counter-offer.
  await buyerPage.reload();
  const buyerCard = buyerPage.getByRole("article", { name: "Proposal: Carousel plus story versions" });
  await expect(buyerCard.getByText("₹2,600")).toBeVisible();
  await buyerCard.getByRole("button", { name: "Counter-offer" }).click();
  const counterForm = buyerPage.getByRole("dialog", { name: "Make a counter-offer" });
  await counterForm.getByLabel("Your price (₹)").fill("2200");
  await counterForm.getByLabel("Note").fill("Could you do it for ₹2,200?");
  await counterForm.getByRole("button", { name: "Send counter-offer" }).click();
  await expect(buyerCard.getByText("Your counter-offer: ₹2,200 · 4 days")).toBeVisible();
  await expect(buyerCard.getByRole("button", { name: "Counter-offer" })).toHaveCount(0);

  // Specialist accepts the counter-offer, which creates the order.
  await specialistPage.reload();
  const specialistCard = specialistPage.getByRole("article", { name: "Proposal: Carousel plus story versions" });
  await specialistCard.getByRole("button", { name: "Accept counter-offer" }).click();
  await expect(specialistCard.getByText("Accepted")).toBeVisible();

  // Buyer pays at the agreed (counter) price on Workido.
  await buyerPage.reload();
  await buyerCard.getByRole("link", { name: "Pay ₹2,200 on Workido" }).click();
  await buyerPage.waitForURL("**/checkout");
  await expect(buyerPage.getByText("₹2,200").first()).toBeVisible();

  await buyerPage.context().close();
  await specialistPage.context().close();
});
