"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/overlays";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/submit-button";
import { submitOfferAction, updateOfferAction } from "@/lib/actions/offers";
import { acceptOfferAction } from "@/lib/actions/requirements";
import { offerSchema, type OfferInput } from "@/lib/validation/requirement";

export function AcceptOfferButton({ offerId, summary }: { offerId: string; summary: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Check aria-hidden /> Accept offer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Accept this offer?" description={summary}>
          <p className="text-sm text-ink-soft">
            We&apos;ll create an order with this exact scope and price. Other pending offers on this task will be declined. You&apos;ll pay on the next screen.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline">Not yet</Button>
            </DialogClose>
            <PendingButton
              pending={pending}
              pendingLabel="Creating order…"
              onClick={() =>
                startTransition(async () => {
                  const result = await acceptOfferAction(offerId);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(result.message ?? "Offer accepted");
                  router.push(`/dashboard/orders/${result.data.orderId}/checkout`);
                })
              }
            >
              Accept & continue to payment
            </PendingButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OfferForm({ requirementId, offerId, defaults }: { requirementId: string; offerId?: string; defaults: OfferInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<OfferInput, unknown, z.output<typeof offerSchema>>({ resolver: zodResolver(offerSchema), defaultValues: defaults });
  const errors = form.formState.errors;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          const result = offerId ? await updateOfferAction(offerId, form.getValues()) : await submitOfferAction(requirementId, form.getValues());
          if (!result.ok) {
            if (result.fieldErrors) for (const [key, message] of Object.entries(result.fieldErrors)) form.setError(key as keyof OfferInput, { message });
            toast.error(result.error);
            return;
          }
          toast.success(result.message ?? "Saved");
          router.refresh();
        }),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="price" label="Your price (₹)" error={errors.price?.message}>
          {(field) => <Input {...field} inputMode="decimal" {...form.register("price")} />}
        </FormField>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Delivery time</span>
          <div className="flex gap-2">
            <Input aria-label="Delivery time" inputMode="numeric" className="w-20" aria-invalid={Boolean(errors.deliveryValue)} {...form.register("deliveryValue")} />
            <Select aria-label="Delivery unit" {...form.register("deliveryUnit")}>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </Select>
          </div>
          {errors.deliveryValue?.message ? <p className="text-xs font-medium text-danger">{errors.deliveryValue.message}</p> : null}
        </div>
        <FormField id="revisionsIncluded" label="Revisions included" error={errors.revisionsIncluded?.message}>
          {(field) => (
            <Select {...field} {...form.register("revisionsIncluded")}>
              {Array.from({ length: 11 }, (_, n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <FormField id="message" label="Message to the buyer" hint="Your approach, relevant experience and any questions. Don't share contact details — keep communication on Workido." error={errors.message?.message}>
        {(field) => <Textarea {...field} rows={5} maxLength={2000} {...form.register("message")} />}
      </FormField>
      <div>
        <PendingButton type="submit" pending={pending} pendingLabel="Sending…">
          {offerId ? "Update offer" : "Send offer"}
        </PendingButton>
      </div>
    </form>
  );
}
