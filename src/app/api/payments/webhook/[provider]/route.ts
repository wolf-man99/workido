import { NextResponse, type NextRequest } from "next/server";
import { getProviderById } from "@/lib/payments/provider";
import { supabaseWebhookStore } from "@/lib/payments/service";
import { processWebhook } from "@/lib/payments/webhooks";

const SIGNATURE_HEADERS: Record<string, string> = {
  razorpay: "x-razorpay-signature",
  dev: "x-workido-dev-signature",
};

/**
 * Payment provider webhooks. Authenticated by the provider's HMAC signature
 * over the raw body (not by cookies). Idempotent per provider event id.
 */
export async function POST(request: NextRequest, context: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider: providerId } = await context.params;
  const provider = getProviderById(providerId);
  const signatureHeader = SIGNATURE_HEADERS[providerId];
  if (!provider || !signatureHeader) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 512 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const outcome = await processWebhook(provider, supabaseWebhookStore(), rawBody, request.headers, request.headers.get(signatureHeader));
  return NextResponse.json({ result: outcome.result }, { status: outcome.status });
}
