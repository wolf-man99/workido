"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/submit-button";
import { createServiceOrderAction, toggleSavedSpecialistAction } from "@/lib/actions/buyer";

export function ServiceOrderForm({ serviceId, instructions }: { serviceId: string; instructions: string | null }) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (brief.trim().length < 10) {
          setError("Tell the specialist what you need (at least 10 characters).");
          return;
        }
        startTransition(async () => {
          const result = await createServiceOrderAction({ serviceId, brief });
          if (!result.ok) {
            setError(result.fieldErrors?.brief ?? result.error);
            return;
          }
          router.push(`/dashboard/orders/${result.data.orderId}/checkout`);
        });
      }}
    >
      <FormField
        id="brief"
        label="Your requirements"
        hint={instructions ? `The specialist asks: ${instructions}` : "Describe what you need, plus any links to brand assets or references."}
        error={error ?? undefined}
      >
        {(field) => <Textarea {...field} rows={5} maxLength={5000} value={brief} onChange={(event) => setBrief(event.target.value)} />}
      </FormField>
      <p className="text-xs text-muted-foreground">You can share files in the order chat after placing the order. Avoid sharing passwords.</p>
      <PendingButton type="submit" size="lg" pending={pending} pendingLabel="Creating order…">
        Continue to payment
      </PendingButton>
    </form>
  );
}

/** "Order now" for buyers who don't need to talk first; reveals the order form. */
export function OrderNowPanel({ serviceId, instructions, label = "Order now" }: { serviceId: string; instructions: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <ServiceOrderForm serviceId={serviceId} instructions={instructions} />;
  return (
    <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
      {label}
    </Button>
  );
}

export function SaveSpecialistButton({ specialistId, initiallySaved }: { specialistId: string; initiallySaved: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleSavedSpecialistAction(specialistId, !saved);
          if (result.ok) {
            setSaved(!saved);
            toast.success(result.message ?? "Updated");
          } else toast.error(result.error);
        })
      }
    >
      {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

export function UnavailableNotice() {
  return (
    <Alert tone="warning" title="Not taking new orders">
      This specialist is currently unavailable. Save them for later, or post a task to get matched with someone available.
    </Alert>
  );
}
