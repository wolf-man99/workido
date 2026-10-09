import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Internal product analytics. Events go to the analytics_events table.
 * To add an external provider (e.g. PostHog), forward from `track` here -
 * call sites stay unchanged. Never pass message bodies, file names, emails,
 * phone numbers or payment details as properties.
 */
export type AnalyticsEvent =
  | "signup_completed"
  | "profile_completed"
  | "specialist_profile_published"
  | "service_published"
  | "requirement_created"
  | "match_results_viewed"
  | "offer_submitted"
  | "offer_accepted"
  | "order_created"
  | "payment_verified"
  | "work_submitted"
  | "revision_requested"
  | "order_completed"
  | "review_submitted"
  | "repeat_hire_started";

type Primitive = string | number | boolean | null;
export type AnalyticsProperties = Record<string, Primitive>;

const BLOCKED_KEYS = /email|phone|password|token|secret|card|message|body|file_?name|full_?name|address/i;

export function sanitizeProperties(properties: AnalyticsProperties = {}): AnalyticsProperties {
  const clean: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (BLOCKED_KEYS.test(key)) continue;
    clean[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  return clean;
}

/** Fire-and-forget: analytics must never break a user flow. */
export async function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}, userId: string | null = null): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    let actor = userId;
    if (!actor) {
      const { data } = await supabase.auth.getClaims();
      actor = data?.claims?.sub ?? null;
    }
    const { error } = await supabase
      .from("analytics_events")
      .insert({ event_name: event, user_id: actor, properties: sanitizeProperties(properties) });
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[analytics] event not recorded", event, error.code);
    }
  } catch {
    // Ignore: analytics is best-effort.
  }
}
