import { z } from "zod";
import { deliveryFields, moneyField, toHours } from "./marketplace";

const MAX_DELIVERY_HOURS = 2160;
const withinDeliveryLimit = (value: { deliveryValue: number; deliveryUnit: "hours" | "days" }) =>
  toHours(value.deliveryValue, value.deliveryUnit) <= MAX_DELIVERY_HOURS;

/** A specialist's proposal in the pre-order chat. */
export const proposalSchema = z
  .object({
    title: z.string().trim().min(5, "At least 5 characters").max(120, "Keep it under 120 characters"),
    description: z.string().trim().min(20, "Describe the work in at least 20 characters").max(5000, "Keep it under 5,000 characters"),
    deliverables: z.string().trim().min(5, "List what the buyer receives").max(2000, "Keep it under 2,000 characters"),
    price: moneyField({ min: 10000, max: 100000000, label: "a price" }),
    ...deliveryFields,
    revisions: z.coerce.number().int().min(0, "0 or more").max(10, "At most 10"),
  })
  .refine(withinDeliveryLimit, { path: ["deliveryValue"], message: "At most 90 days" });
export type ProposalInput = z.input<typeof proposalSchema>;

/** The buyer's single counter-offer: price and/or delivery time, plus a note. */
export const counterOfferSchema = z
  .object({
    price: moneyField({ min: 10000, max: 100000000, label: "a price" }),
    ...deliveryFields,
    note: z.string().trim().max(1000, "Keep it under 1,000 characters"),
  })
  .refine(withinDeliveryLimit, { path: ["deliveryValue"], message: "At most 90 days" });
export type CounterOfferInput = z.input<typeof counterOfferSchema>;
