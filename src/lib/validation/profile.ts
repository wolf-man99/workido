import { z } from "zod";

const optionalText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Keep it under ${max} characters`)
    .transform((value) => (value === "" ? null : value));

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(100, "Name is too long"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/, "3–30 characters: letters, numbers, - and _, starting and ending with a letter or number"),
  bio: optionalText(500),
  city: optionalText(80),
  region: optionalText(80),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Use a 2-letter country code, e.g. IN")
    .transform((value) => (value === "" ? null : value)),
  websiteUrl: z
    .string()
    .trim()
    .refine((value) => value === "" || /^https?:\/\/\S+\.\S+/i.test(value), "Enter a full URL starting with https://")
    .transform((value) => (value === "" ? null : value)),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const settingsSchema = z.object({
  emailNotifications: z.boolean(),
  marketingEmails: z.boolean(),
  whatsappOptIn: z.boolean(),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\+?[0-9 ()-]{7,20}$/.test(value), "Enter a valid phone number")
    .transform((value) => (value === "" ? null : value)),
});
export type SettingsInput = z.input<typeof settingsSchema>;
