"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { track, type AnalyticsProperties } from "@/lib/analytics/track";

/** Events the browser may report. Everything else is tracked server-side only. */
const CLIENT_EVENTS = new Set(["match_results_viewed"] as const);
type ClientEvent = "match_results_viewed";

export async function trackClientEventAction(event: ClientEvent, properties: AnalyticsProperties): Promise<void> {
  if (!CLIENT_EVENTS.has(event)) return;
  const user = await getCurrentUser();
  if (!user) return;
  await track(event, properties, user.id);
}
