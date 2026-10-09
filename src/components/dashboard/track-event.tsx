"use client";

import { useEffect, useRef } from "react";
import { trackClientEventAction } from "@/lib/actions/analytics";

/** Records a whitelisted analytics event once when mounted. */
export function TrackEvent({ event, properties }: { event: "match_results_viewed"; properties: Record<string, string | number | boolean | null> }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void trackClientEventAction(event, properties);
  }, [event, properties]);
  return null;
}
