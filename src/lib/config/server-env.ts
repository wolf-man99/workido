import "server-only";
import { z } from "zod";

/**
 * Server-only configuration. Importing this module from a Client Component
 * fails the build ("server-only"), which keeps secrets out of the browser.
 *
 * Optional integrations are validated lazily by the module that needs them
 * (payments, email, service-role access) so the app still runs - and
 * explains what is missing - when they are not configured.
 */
const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim()));

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  PAYMENT_PROVIDER: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim().toLowerCase())
    .pipe(z.enum(["", "dev", "razorpay"])),
  ALLOW_DEV_PAYMENTS: optionalString,
  DEV_PAYMENTS_SECRET: optionalString,
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  CRON_SECRET: optionalString,
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid server configuration:\n${details}\nSee .env.example and docs/ENVIRONMENT.md.`);
  }
  cached = parsed.data;
  return cached;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
