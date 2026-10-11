"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileSignature } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/overlays";
import { PendingButton } from "@/components/ui/submit-button";
import { counterProposalAction, sendProposalAction } from "@/lib/actions/proposals";
import { minorToMajorInput } from "@/lib/domain/money";
import { fromHours } from "@/lib/validation/marketplace";
import { counterOfferSchema, proposalSchema, type CounterOfferInput, type ProposalInput } from "@/lib/validation/proposal";

export interface ProposalDefaults {
  serviceId: string | null;
  title: string;
  description: string;
  deliverables: string;
  priceMinor: number | null;
  deliveryTimeHours: number | null;
  revisions: number | null;
}

function DeliveryInputs({
  register,
  error,
}: {
  register: (name: "deliveryValue" | "deliveryUnit") => object;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">Delivery time</span>
      <div className="flex gap-2">
        <Input aria-label="Delivery time" inputMode="numeric" className="w-20" aria-invalid={Boolean(error)} {...register("deliveryValue")} />
        <Select aria-label="Delivery unit" {...register("deliveryUnit")}>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </Select>
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}

/** Specialist: send a proposal with scope, price, delivery time and revisions. */
export function SendProposalButton({
  conversationId,
  defaults,
  hasOpenProposal,
  onSent,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & { conversationId: string; defaults: ProposalDefaults; hasOpenProposal: boolean; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const delivery = defaults.deliveryTimeHours ? fromHours(defaults.deliveryTimeHours) : { deliveryValue: "3", deliveryUnit: "days" as const };
  const form = useForm<ProposalInput, unknown, z.output<typeof proposalSchema>>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: defaults.title,
      description: defaults.description,
      deliverables: defaults.deliverables,
      price: defaults.priceMinor ? minorToMajorInput(defaults.priceMinor) : "",
      deliveryValue: delivery.deliveryValue,
      deliveryUnit: delivery.deliveryUnit,
      revisions: String(defaults.revisions ?? 1),
    },
  });
  const errors = form.formState.errors;

  return (
    <>
      <Button variant="outline" {...buttonProps} onClick={() => setOpen(true)}>
        <FileSignature aria-hidden /> {hasOpenProposal ? "Send an updated proposal" : "Send a proposal"}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent
          title={hasOpenProposal ? "Send an updated proposal" : "Send a proposal"}
          description="Set out exactly what you'll deliver. The buyer can accept and pay, or make one counter-offer."
          className="sm:max-w-xl"
        >
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={form.handleSubmit(() =>
              startTransition(async () => {
                const result = await sendProposalAction(conversationId, form.getValues(), defaults.serviceId);
                if (!result.ok) {
                  if (result.fieldErrors) for (const [key, message] of Object.entries(result.fieldErrors)) form.setError(key as keyof ProposalInput, { message });
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message ?? "Proposal sent");
                setOpen(false);
                onSent?.();
              }),
            )}
          >
            {hasOpenProposal ? <p className="rounded-xl bg-sun-soft px-3 py-2 text-xs text-ink-soft">Your current proposal will be replaced by this one.</p> : null}
            <FormField id="proposal-title" label="Title" error={errors.title?.message}>
              {(field) => <Input {...field} maxLength={120} {...form.register("title")} />}
            </FormField>
            <FormField id="proposal-description" label="What you'll do" error={errors.description?.message}>
              {(field) => <Textarea {...field} rows={4} maxLength={5000} {...form.register("description")} />}
            </FormField>
            <FormField id="proposal-deliverables" label="What the buyer receives" error={errors.deliverables?.message}>
              {(field) => <Textarea {...field} rows={2} maxLength={2000} {...form.register("deliverables")} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="proposal-price" label="Price (₹)" error={errors.price?.message}>
                {(field) => <Input {...field} inputMode="decimal" {...form.register("price")} />}
              </FormField>
              <DeliveryInputs register={(name) => form.register(name)} error={errors.deliveryValue?.message} />
              <FormField id="proposal-revisions" label="Revisions" error={errors.revisions?.message}>
                {(field) => (
                  <Select {...field} {...form.register("revisions")}>
                    {Array.from({ length: 11 }, (_, n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <p className="text-xs text-muted-foreground">The buyer pays through Workido when they accept. Proposals stay open for 7 days.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <PendingButton type="submit" pending={pending} pendingLabel="Sending…">
                Send proposal
              </PendingButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Buyer: one counter-offer on price and/or delivery time. */
export function CounterOfferButton({
  proposalId,
  priceMinor,
  deliveryTimeHours,
  specialistName,
  onSent,
}: {
  proposalId: string;
  priceMinor: number;
  deliveryTimeHours: number;
  specialistName: string;
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const delivery = fromHours(deliveryTimeHours);
  const form = useForm<CounterOfferInput, unknown, z.output<typeof counterOfferSchema>>({
    resolver: zodResolver(counterOfferSchema),
    defaultValues: { price: minorToMajorInput(priceMinor), deliveryValue: delivery.deliveryValue, deliveryUnit: delivery.deliveryUnit, note: "" },
  });
  const errors = form.formState.errors;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Counter-offer
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent title="Make a counter-offer" description={`You can counter once. ${specialistName} can accept it or keep the original proposal.`}>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={form.handleSubmit(() =>
              startTransition(async () => {
                const result = await counterProposalAction(proposalId, form.getValues());
                if (!result.ok) {
                  if (result.fieldErrors) for (const [key, message] of Object.entries(result.fieldErrors)) form.setError(key as keyof CounterOfferInput, { message });
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message ?? "Counter-offer sent");
                setOpen(false);
                onSent?.();
              }),
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="counter-price" label="Your price (₹)" error={errors.price?.message}>
                {(field) => <Input {...field} inputMode="decimal" {...form.register("price")} />}
              </FormField>
              <DeliveryInputs register={(name) => form.register(name)} error={errors.deliveryValue?.message} />
            </div>
            <FormField id="counter-note" label="Note" optional error={errors.note?.message}>
              {(field) => <Textarea {...field} rows={3} maxLength={1000} placeholder="Explain what you'd like to change." {...form.register("note")} />}
            </FormField>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <PendingButton type="submit" pending={pending} pendingLabel="Sending…">
                Send counter-offer
              </PendingButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
