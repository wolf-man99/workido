import { getPublicEnv } from "./public-env";

/**
 * Brand and messaging configuration.
 *
 * IMPORTANT: Workido's tagline has NOT been approved. Nothing in the UI uses a
 * hard-coded tagline. If NEXT_PUBLIC_BRAND_TAGLINE is set it is shown in the
 * footer and metadata; otherwise neutral, benefit-oriented copy is used.
 * Homepage hero copy below is editable example copy, not a brand decision.
 */
export function getSiteConfig() {
  const env = getPublicEnv();
  const social = [
    env.NEXT_PUBLIC_SOCIAL_INSTAGRAM ? { label: "Instagram", href: env.NEXT_PUBLIC_SOCIAL_INSTAGRAM } : null,
    env.NEXT_PUBLIC_SOCIAL_LINKEDIN ? { label: "LinkedIn", href: env.NEXT_PUBLIC_SOCIAL_LINKEDIN } : null,
    env.NEXT_PUBLIC_SOCIAL_X ? { label: "X", href: env.NEXT_PUBLIC_SOCIAL_X } : null,
  ].filter((item): item is { label: string; href: string } => item !== null);

  return {
    name: "Workido",
    url: env.NEXT_PUBLIC_APP_URL,
    tagline: env.NEXT_PUBLIC_BRAND_TAGLINE ?? null,
    description:
      "Get small professional tasks done by skilled, available specialists — from design and video to ads, SEO and analytics.",
    hero: {
      headline: "Got a task? Find your person.",
      subheadline:
        "Workido connects you with skilled specialists for small professional tasks — no agency retainers, no full-time hires. Describe what you need, agree a clear scope and price, and get it done.",
    },
    supportEmail: env.NEXT_PUBLIC_SUPPORT_EMAIL ?? null,
    social,
  };
}

export type SiteConfig = ReturnType<typeof getSiteConfig>;
