"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import { completeDevCheckout, executeRefund, recordCheckoutFailure, startCheckout, verifyCheckoutPayment, type CheckoutSession } from "@/lib/payments/service";
import { PaymentError } from "@/lib/payments/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/marketplace";
import { fail, ok, type ActionResult } from "./result";

function paymentFailure(error: unknown, fallback = "Payment could not be processed. Please try again."): ActionResult<never> {
  if (error instanceof PaymentError) {
    console.error("[payments]", error.message);
    return fail(error.userMessage);
  }
  console.error("[payments] unexpected error", error instanceof Error ? error.message : error);
  return fail(fallback);
}

async function buyerFor(orderId: string) {
  const user = await getCurrentUser();
  if (!user || user.accountStatus !== "active") return null;
  if (!uuid.safeParse(orderId).success) return null;
  // Confirms ownership through RLS with the user's own session.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("orders").select("id").eq("id", orderId).eq("buyer_id", user.id).maybeSingle();
  return data ? user : null;
}

export async function startCheckoutAction(orderId: string): Promise<ActionResult<CheckoutSession & { prefill: { name: string; email: string | null } }>> {
  const user = await buyerFor(orderId);
  if (!user) return fail("Order not found.");
  try {
    const session = await startCheckout(orderId, user.id);
    return ok({ ...session, prefill: { name: user.fullName, email: user.email } });
  } catch (error) {
    return paymentFailure(error);
  }
}

const callbackSchema = z.object({
  providerOrderId: z.string().min(5).max(100),
  providerPaymentId: z.string().min(5).max(100),
  signature: z.string().min(16).max(256),
});

/** Razorpay checkout success callback. Verified server-side before anything changes. */
export async function verifyPaymentAction(orderId: string, input: z.input<typeof callbackSchema>): Promise<ActionResult<undefined>> {
  const user = await buyerFor(orderId);
  if (!user) return fail("Order not found.");
  const parsed = callbackSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid payment response.");
  try {
    const result = await verifyCheckoutPayment({ orderId, buyerId: user.id, ...parsed.data });
    if (result === "applied") await track("payment_verified", { order_id: orderId }, user.id);
    revalidatePath(`/dashboard/orders/${orderId}`);
    return ok(undefined, "Payment verified");
  } catch (error) {
    return paymentFailure(error);
  }
}

export async function reportPaymentFailureAction(orderId: string, input: { providerOrderId: string; reason: string }): Promise<ActionResult<undefined>> {
  const user = await buyerFor(orderId);
  if (!user) return fail("Order not found.");
  try {
    await recordCheckoutFailure({ orderId, buyerId: user.id, providerOrderId: input.providerOrderId.slice(0, 100), reason: input.reason });
    revalidatePath(`/dashboard/orders/${orderId}`);
    return ok(undefined);
  } catch (error) {
    return paymentFailure(error);
  }
}

/** Development adapter only. Refused when a live provider is configured. */
export async function completeDevPaymentAction(orderId: string, providerOrderId: string, outcome: "success" | "failure"): Promise<ActionResult<undefined>> {
  const user = await buyerFor(orderId);
  if (!user) return fail("Order not found.");
  try {
    const result = await completeDevCheckout({ orderId, buyerId: user.id, providerOrderId, outcome });
    if (result === "applied") await track("payment_verified", { order_id: orderId, provider: "dev" }, user.id);
    revalidatePath(`/dashboard/orders/${orderId}`);
    return outcome === "success" ? ok(undefined, "Test payment verified") : fail("The simulated payment failed. You can try again.");
  } catch (error) {
    return paymentFailure(error);
  }
}

/** Admin: send a pending refund to the payment provider. */
export async function processRefundAction(refundId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user?.isAdmin || user.accountStatus !== "active") return fail("Administrator access required.");
  if (!uuid.safeParse(refundId).success) return fail("Invalid refund.");
  // Double-check admin status in the database, not just the session.
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return fail("Administrator access required.");
  try {
    const status = await executeRefund(refundId);
    revalidatePath("/admin", "layout");
    return ok(undefined, status === "succeeded" ? "Refund confirmed by the provider" : "Refund submitted; awaiting provider confirmation");
  } catch (error) {
    return paymentFailure(error, "The refund could not be processed.");
  }
}
