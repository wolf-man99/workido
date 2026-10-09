import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/config/public-env";
import { ConfigurationError, getServerEnv } from "@/lib/config/server-env";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Only used for operations that have no end-user session or that must be
 * trusted (payment verification, webhooks, the notification email
 * dispatcher). Never import this into Client Components ("server-only"
 * enforces that) and never use it to perform an action on behalf of a user
 * without first authorising that user explicitly.
 */
export function isServiceRoleConfigured(): boolean {
  return Boolean(getServerEnv().SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseServiceClient() {
  const key = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new ConfigurationError(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. It is required for payment verification, webhooks and email dispatch. Add it to your server environment (never to NEXT_PUBLIC_* variables).",
    );
  }
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type ServiceSupabaseClient = ReturnType<typeof createSupabaseServiceClient>;
