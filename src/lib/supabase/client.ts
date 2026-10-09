"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/config/public-env";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Supabase client for Client Components. Uses the public anon/publishable key only. */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const env = getPublicEnv();
    browserClient = createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return browserClient;
}
