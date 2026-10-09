import { z } from "zod";

/**
 * Public (browser-safe) configuration. NEXT_PUBLIC_* values are inlined into
 * client bundles at build time, so each must be referenced literally below.
 * Never put secrets in NEXT_PUBLIC_* variables.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required (anon or publishable key)" })
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short"),
  NEXT_PUBLIC_BRAND_TAGLINE: z.string().max(80).optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.email().optional(),
  NEXT_PUBLIC_SOCIAL_INSTAGRAM: z.url().optional(),
  NEXT_PUBLIC_SOCIAL_LINKEDIN: z.url().optional(),
  NEXT_PUBLIC_SOCIAL_X: z.url().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

function emptyToUndefined(value: string | undefined) {
  return value === undefined || value.trim() === "" ? undefined : value;
}

let cached: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: emptyToUndefined(process.env.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_BRAND_TAGLINE: emptyToUndefined(process.env.NEXT_PUBLIC_BRAND_TAGLINE),
    NEXT_PUBLIC_SUPPORT_EMAIL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
    NEXT_PUBLIC_SOCIAL_INSTAGRAM: emptyToUndefined(process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM),
    NEXT_PUBLIC_SOCIAL_LINKEDIN: emptyToUndefined(process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN),
    NEXT_PUBLIC_SOCIAL_X: emptyToUndefined(process.env.NEXT_PUBLIC_SOCIAL_X),
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Workido is missing required public configuration:\n${details}\nSee .env.example and docs/ENVIRONMENT.md.`);
  }
  cached = parsed.data;
  return cached;
}
