import "server-only";
import { getServerEnv } from "@/lib/config/server-env";
import { createDevProvider } from "./dev";
import { createRazorpayProvider } from "./razorpay";
import type { PaymentProvider } from "./types";

export type PaymentConfigStatus =
  | { configured: true; provider: PaymentProvider }
  | { configured: false; reason: string };

/**
 * Resolves the configured payment provider. Never silently falls back to the
 * development adapter: it must be selected explicitly with PAYMENT_PROVIDER=dev
 * and is refused in production unless ALLOW_DEV_PAYMENTS=true.
 */
export function getPaymentConfig(): PaymentConfigStatus {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { configured: false, reason: "SUPABASE_SERVICE_ROLE_KEY is required to verify payments on the server." };
  }
  switch (env.PAYMENT_PROVIDER) {
    case "razorpay":
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        return { configured: false, reason: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable Razorpay." };
      }
      return {
        configured: true,
        provider: createRazorpayProvider({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET }),
      };
    case "dev":
      if (!env.DEV_PAYMENTS_SECRET || env.DEV_PAYMENTS_SECRET.length < 16) {
        return { configured: false, reason: "Set DEV_PAYMENTS_SECRET (16+ characters) to use the development payment adapter." };
      }
      if (env.NODE_ENV === "production" && env.ALLOW_DEV_PAYMENTS !== "true") {
        return { configured: false, reason: "The development payment adapter is disabled in production. Configure Razorpay, or set ALLOW_DEV_PAYMENTS=true for a private test deployment." };
      }
      return { configured: true, provider: createDevProvider(env.DEV_PAYMENTS_SECRET) };
    default:
      return { configured: false, reason: "No payment provider is configured (PAYMENT_PROVIDER)." };
  }
}

/** Provider used to verify an incoming webhook for a specific provider id. */
export function getProviderById(id: string): PaymentProvider | null {
  const config = getPaymentConfig();
  return config.configured && config.provider.id === id ? config.provider : null;
}
