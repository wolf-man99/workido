import { z } from "zod";
import { deliveryFields, moneyField, optionalMoneyField, uuid } from "./marketplace";

const optionalUuid = z.union([uuid, z.literal("")]);
const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max), `${label} must be between ${min} and ${max}`)
    .transform((value) => (value === "" ? null : Number(value)));

const linkList = z
  .array(z.string().trim())
  .transform((links) => links.filter((link) => link !== ""))
  .pipe(z.array(z.string().regex(/^https?:\/\/\S+\.\S+/i, "Links must start with https://").max(500)).max(10, "Add up to 10 links"));

const skillSelection = z
  .array(z.object({ skillId: uuid, mandatory: z.boolean() }))
  .max(10, "Pick up to 10 skills");

/** Step 1: describe the requirement. */
export const requirementDescribeSchema = z.object({
  title: z.string().trim().min(8, "At least 8 characters").max(120, "Keep it under 120 characters"),
  description: z.string().trim().min(30, "Describe the task in at least 30 characters").max(5000),
  categoryId: z.string().min(1, "Choose a category").pipe(uuid),
  subcategoryId: optionalUuid,
  skills: skillSelection,
});

/** Step 2: scope, budget and deadline. */
export const requirementScopeSchema = z.object({
  budgetMin: optionalMoneyField({ max: 100000000, label: "minimum budget" }),
  budgetMax: moneyField({ min: 10000, max: 100000000, label: "your maximum budget" }),
  deadline: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Choose a valid date"),
  deliverables: z.string().trim().max(2000),
  quantity: optionalInt(1, 1000, "Quantity"),
  revisionsExpected: optionalInt(0, 10, "Revisions"),
  referenceLinks: linkList,
});

/** Step 3: matching preferences (all optional). */
export const requirementPreferencesSchema = z.object({
  preferredExperience: z.enum(["", "entry", "intermediate", "expert"]),
  locationPreference: z.string().trim().max(100),
  remoteOk: z.boolean(),
  urgency: z.enum(["flexible", "standard", "urgent"]),
});

export const requirementSchema = requirementDescribeSchema
  .extend(requirementScopeSchema.shape)
  .extend(requirementPreferencesSchema.shape)
  .refine((value) => value.budgetMin === null || value.budgetMin <= value.budgetMax, {
    message: "Minimum budget can't exceed the maximum",
    path: ["budgetMin"],
  });

export type RequirementInput = z.input<typeof requirementSchema>;
export type RequirementValues = z.output<typeof requirementSchema>;

/** Drafts only need a title; everything else is validated for shape. */
export const requirementDraftSchema = z.object({
  title: z.string().trim().min(3, "Add a title (at least 3 characters)").max(120),
  description: z.string().trim().max(5000),
  categoryId: optionalUuid,
  subcategoryId: optionalUuid,
  skills: skillSelection,
  budgetMin: optionalMoneyField({ max: 100000000, label: "minimum budget" }),
  budgetMax: optionalMoneyField({ max: 100000000, label: "maximum budget" }),
  deadline: z.string().trim().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Choose a valid date"),
  deliverables: z.string().trim().max(2000),
  quantity: optionalInt(1, 1000, "Quantity"),
  revisionsExpected: optionalInt(0, 10, "Revisions"),
  referenceLinks: linkList,
  preferredExperience: z.enum(["", "entry", "intermediate", "expert"]),
  locationPreference: z.string().trim().max(100),
  remoteOk: z.boolean(),
  urgency: z.enum(["flexible", "standard", "urgent"]),
});

export const STEP_FIELDS = {
  describe: ["title", "description", "categoryId", "subcategoryId", "skills"],
  scope: ["budgetMin", "budgetMax", "deadline", "deliverables", "quantity", "revisionsExpected", "referenceLinks"],
  preferences: ["preferredExperience", "locationPreference", "remoteOk", "urgency"],
} as const;

export const emptyRequirement: RequirementInput = {
  title: "",
  description: "",
  categoryId: "",
  subcategoryId: "",
  skills: [],
  budgetMin: "",
  budgetMax: "",
  deadline: "",
  deliverables: "",
  quantity: "",
  revisionsExpected: "",
  referenceLinks: [""],
  preferredExperience: "",
  locationPreference: "",
  remoteOk: true,
  urgency: "standard",
};

/* ---------------------------------- Offers ---------------------------------- */

export const offerSchema = z.object({
  price: moneyField({ min: 10000, max: 100000000, label: "your price" }),
  ...deliveryFields,
  revisionsIncluded: z.coerce.number().int().min(0).max(10),
  message: z.string().trim().min(20, "Explain your approach in at least 20 characters").max(2000),
});
export type OfferInput = z.input<typeof offerSchema>;
