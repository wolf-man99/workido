import { describe, expect, it } from "vitest";
import { mentionsContactDetails } from "@/lib/chat/contact-details";
import { isProposalOpen } from "@/lib/chat/messages";
import { counterOfferSchema, proposalSchema } from "@/lib/validation/proposal";
import { CONTACT_CASES } from "../support/contact-cases";

describe("mentionsContactDetails", () => {
  it.each(CONTACT_CASES)("%s -> %s", (text, expected) => {
    expect(mentionsContactDetails(text)).toBe(expected);
  });

  it("ignores empty input", () => {
    expect(mentionsContactDetails("")).toBe(false);
    expect(mentionsContactDetails(null)).toBe(false);
  });
});

describe("proposal validation", () => {
  const valid = {
    title: "Instagram posts + stories",
    description: "Three posts and matching 9:16 stories from your copy and brand kit.",
    deliverables: "3 posts and 3 stories as PNG",
    price: "1,400",
    deliveryValue: "3",
    deliveryUnit: "days" as const,
    revisions: "1",
  };

  it("parses price to minor units and delivery to a number", () => {
    const parsed = proposalSchema.parse(valid);
    expect(parsed.price).toBe(140000);
    expect(parsed.deliveryValue).toBe(3);
    expect(parsed.revisions).toBe(1);
  });

  it("rejects too-short scope, tiny prices and deliveries over 90 days", () => {
    expect(proposalSchema.safeParse({ ...valid, description: "Too short" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...valid, price: "50" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...valid, deliveryValue: "91" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...valid, deliveryValue: "90" }).success).toBe(true);
  });

  it("validates counter-offers", () => {
    expect(counterOfferSchema.parse({ price: "1200", deliveryValue: "48", deliveryUnit: "hours", note: "" }).price).toBe(120000);
    expect(counterOfferSchema.safeParse({ price: "1200", deliveryValue: "48", deliveryUnit: "hours", note: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("isProposalOpen", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();
  it("is open while pending or countered and not expired", () => {
    expect(isProposalOpen({ status: "pending", expires_at: future })).toBe(true);
    expect(isProposalOpen({ status: "countered", expires_at: future })).toBe(true);
    expect(isProposalOpen({ status: "pending", expires_at: past })).toBe(false);
    expect(isProposalOpen({ status: "accepted", expires_at: future })).toBe(false);
  });
});
