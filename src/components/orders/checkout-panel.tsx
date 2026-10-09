"use client";

import { FlaskConical, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { PendingButton } from "@/components/ui/submit-button";
import { completeDevPaymentAction, reportPaymentFailureAction, startCheckoutAction, verifyPaymentAction } from "@/lib/actions/payments";
import { formatMoney } from "@/lib/domain/money";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

export function CheckoutPanel({ orderId, totalMinor, currency, title }: { orderId: string; totalMinor: number; currency: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [devOrderId, setDevOrderId] = useState<string | null>(null);

  const finish = (message: string) => {
    toast.success(message);
    router.push(`/dashboard/orders/${orderId}?paid=1`);
    router.refresh();
  };

  const pay = () =>
    startTransition(async () => {
      setError(null);
      const session = await startCheckoutAction(orderId);
      if (!session.ok) {
        setError(session.error);
        return;
      }
      if (session.data.provider === "dev") {
        setDevOrderId(session.data.providerOrderId);
        return;
      }
      try {
        await loadRazorpayScript();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load the payment window.");
        return;
      }
      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        setError("Could not load the payment window.");
        return;
      }
      const checkout = new Razorpay({
        key: session.data.publicKey,
        order_id: session.data.providerOrderId,
        amount: session.data.amountMinor,
        currency: session.data.currency,
        name: "Workido",
        description: title.slice(0, 250),
        prefill: { name: session.data.prefill.name, email: session.data.prefill.email ?? undefined },
        theme: { color: "#FF6B35" },
        handler: (response: RazorpaySuccess) => {
          startTransition(async () => {
            const verified = await verifyPaymentAction(orderId, {
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            if (verified.ok) finish("Payment verified");
            else setError(verified.error);
          });
        },
        modal: { ondismiss: () => toast("Payment window closed. You can try again any time.") },
      });
      checkout.on("payment.failed", (response) => {
        void reportPaymentFailureAction(orderId, {
          providerOrderId: session.data.providerOrderId,
          reason: response.error.description ?? "Payment failed",
        });
        setError(`Payment failed: ${response.error.description ?? "please try another method"}. You have not been charged for a failed payment.`);
      });
      checkout.open();
    });

  const simulate = (outcome: "success" | "failure") =>
    startTransition(async () => {
      if (!devOrderId) return;
      setError(null);
      const result = await completeDevPaymentAction(orderId, devOrderId, outcome);
      if (result.ok) finish(result.message ?? "Test payment verified");
      else setError(result.error);
    });

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {devOrderId ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-sun bg-sun-soft p-4">
          <p className="flex items-center gap-2 font-display font-bold text-warning-text">
            <FlaskConical className="size-5" aria-hidden /> Test payment — no real money
          </p>
          <p className="text-sm text-warning-text">
            This environment uses the development payment adapter. Choose an outcome to simulate the provider&apos;s response. The result is verified
            on the server exactly like a real payment.
          </p>
          <div className="flex flex-wrap gap-2">
            <PendingButton pending={pending} onClick={() => simulate("success")}>
              Simulate successful payment
            </PendingButton>
            <Button variant="outline" disabled={pending} onClick={() => simulate("failure")}>
              Simulate failed payment
            </Button>
          </div>
        </div>
      ) : (
        <PendingButton size="lg" pending={pending} pendingLabel="Opening secure payment…" onClick={pay}>
          <Lock aria-hidden /> Pay {formatMoney(totalMinor, currency)}
        </PendingButton>
      )}
    </div>
  );
}
