import { z } from "zod";
import { MoneyParseError, parseMajorToMinor } from "@/lib/domain/money";

export const uuid = z.uuid("Invalid id");

/** Major-unit money string ("1500" / "1,500.50") -> integer minor units. */
export function moneyField({ min, max, label }: { min: number; max: number; label: string }) {
  return z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .transform((value, ctx) => {
      try {
        return parseMajorToMinor(value);
      } catch (error) {
        ctx.addIssue({ code: "custom", message: error instanceof MoneyParseError ? error.message : "Enter a valid amount" });
        return z.NEVER;
      }
    })
    .refine((minor) => minor >= min, `Minimum is ₹${min / 100}`)
    .refine((minor) => minor <= max, `Maximum is ₹${(max / 100).toLocaleString("en-IN")}`);
}

export function optionalMoneyField({ max, label }: { max: number; label: string }) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      try {
        return parseMajorToMinor(value);
      } catch {
        ctx.addIssue({ code: "custom", message: `Enter a valid ${label}` });
        return z.NEVER;
      }
    })
    .refine((minor) => minor === null || minor <= max, `Maximum is ₹${(max / 100).toLocaleString("en-IN")}`);
}

/** Delivery time entered as a number plus unit -> hours. */
export const deliveryFields = {
  deliveryValue: z.coerce.number({ error: "Enter a number" }).int("Use a whole number").min(1, "At least 1").max(2160, "Too long"),
  deliveryUnit: z.enum(["hours", "days"]),
};

export function toHours(value: number, unit: "hours" | "days") {
  return unit === "days" ? value * 24 : value;
}

export function fromHours(hours: number): { deliveryValue: string; deliveryUnit: "hours" | "days" } {
  return hours % 24 === 0 ? { deliveryValue: String(hours / 24), deliveryUnit: "days" } : { deliveryValue: String(hours), deliveryUnit: "hours" };
}

/* ----------------------------- Specialist profile ---------------------------- */

export const specialistProfileSchema = z.object({
  headline: z.string().trim().min(10, "At least 10 characters").max(120, "Keep it under 120 characters"),
  professionalBio: z.string().trim().min(50, "At least 50 characters so buyers understand what you do").max(3000, "Keep it under 3,000 characters"),
  // Form input is a plain string (empty until chosen); output is the enum.
  experienceLevel: z.string().pipe(z.enum(["entry", "intermediate", "expert"], { error: "Choose your experience level" })),
  yearsExperience: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,2}$/.test(value) && Number(value) <= 60), "Enter years between 0 and 60")
    .transform((value) => (value === "" ? null : Number(value))),
  skillIds: z.array(uuid).min(1, "Pick at least one skill").max(15, "Pick up to 15 skills"),
  categoryIds: z.array(uuid).min(1, "Pick at least one category").max(5, "Pick up to 5 categories"),
});
export type SpecialistProfileInput = z.input<typeof specialistProfileSchema>;

export const availabilitySchema = z.object({
  availability: z.enum(["available", "busy", "unavailable"]),
});

export const portfolioLinkSchema = z.object({
  title: z.string().trim().min(2, "Add a title").max(100),
  description: z.string().trim().max(1000).optional().default(""),
  categoryId: z.union([uuid, z.literal("")]).optional().default(""),
  externalUrl: z.string().trim().regex(/^https?:\/\/\S+\.\S+/i, "Enter a full URL starting with https://").max(500),
});
export type PortfolioLinkInput = z.input<typeof portfolioLinkSchema>;

export const portfolioUploadSchema = z.object({
  title: z.string().trim().min(2, "Add a title").max(100),
  description: z.string().trim().max(1000).optional().default(""),
  categoryId: z.union([uuid, z.literal("")]).optional().default(""),
  path: z.string().min(3),
});

/* --------------------------------- Services --------------------------------- */

export const serviceSchema = z.object({
  title: z.string().trim().min(8, "At least 8 characters").max(100, "Keep it under 100 characters"),
  categoryId: uuid,
  description: z.string().trim().min(30, "Describe the service in at least 30 characters").max(5000),
  deliverables: z.string().trim().min(5, "List what the buyer receives").max(2000),
  buyerInstructions: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (value === "" ? null : value)),
  price: moneyField({ min: 10000, max: 100000000, label: "a price" }),
  ...deliveryFields,
  includedRevisions: z.coerce.number().int().min(0, "0 or more").max(10, "At most 10"),
  publish: z.boolean(),
});
export type ServiceInput = z.input<typeof serviceSchema>;
