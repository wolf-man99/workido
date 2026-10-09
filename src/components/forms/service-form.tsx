"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/submit-button";
import { createServiceAction, updateServiceAction } from "@/lib/actions/specialist";
import { serviceSchema, type ServiceInput } from "@/lib/validation/marketplace";

export interface CategoryOption {
  id: string;
  label: string;
}

export function ServiceForm({
  serviceId,
  defaults,
  categories,
  profilePublished,
}: {
  serviceId?: string;
  defaults: ServiceInput;
  categories: CategoryOption[];
  profilePublished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ServiceInput, unknown, z.output<typeof serviceSchema>>({ resolver: zodResolver(serviceSchema), defaultValues: defaults });
  const errors = form.formState.errors;

  const submit = (publish: boolean) =>
    form.handleSubmit(() =>
      startTransition(async () => {
        const values = { ...form.getValues(), publish };
        const result = serviceId ? await updateServiceAction(serviceId, values) : await createServiceAction(values);
        if (!result.ok) {
          if (result.fieldErrors) {
            for (const [key, message] of Object.entries(result.fieldErrors)) form.setError(key as keyof ServiceInput, { message });
          }
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Saved");
        router.push("/dashboard/specialist/services");
        router.refresh();
      }),
    );

  return (
    <form onSubmit={submit(true)} className="flex flex-col gap-5" noValidate>
      <FormField id="title" label="Service title" hint="Be specific, e.g. “Instagram carousel design (up to 8 slides)”." error={errors.title?.message}>
        {(field) => <Input {...field} maxLength={100} {...form.register("title")} />}
      </FormField>
      <FormField id="categoryId" label="Category" error={errors.categoryId?.message}>
        {(field) => (
          <Select {...field} {...form.register("categoryId")}>
            <option value="">Choose a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField id="description" label="Description" hint="What's included, your process and who it's for." error={errors.description?.message}>
        {(field) => <Textarea {...field} rows={6} maxLength={5000} {...form.register("description")} />}
      </FormField>
      <FormField id="deliverables" label="Deliverables" hint="Exactly what the buyer receives (formats, quantities)." error={errors.deliverables?.message}>
        {(field) => <Textarea {...field} rows={3} maxLength={2000} {...form.register("deliverables")} />}
      </FormField>
      <FormField id="buyerInstructions" label="What you need from the buyer" optional hint="Shown when a buyer places an order." error={errors.buyerInstructions?.message}>
        {(field) => <Textarea {...field} rows={3} maxLength={2000} {...form.register("buyerInstructions")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="price" label="Price (₹)" hint="Fixed price for this scope." error={errors.price?.message}>
          {(field) => <Input {...field} inputMode="decimal" placeholder="1500" {...form.register("price")} />}
        </FormField>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Delivery time</span>
          <div className="flex gap-2">
            <Input aria-label="Delivery time" inputMode="numeric" className="w-24" aria-invalid={Boolean(errors.deliveryValue)} {...form.register("deliveryValue")} />
            <Select aria-label="Delivery unit" {...form.register("deliveryUnit")}>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </Select>
          </div>
          {errors.deliveryValue?.message ? <p className="text-xs font-medium text-danger">{errors.deliveryValue.message}</p> : null}
        </div>
        <FormField id="includedRevisions" label="Included revisions" error={errors.includedRevisions?.message}>
          {(field) => (
            <Select {...field} {...form.register("includedRevisions")}>
              {Array.from({ length: 11 }, (_, n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      {!profilePublished ? (
        <p className="rounded-2xl bg-sun-soft p-3 text-sm text-warning-text">
          Your profile isn&apos;t published yet, so published services stay hidden until you publish your profile.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <PendingButton type="submit" pending={pending} pendingLabel="Saving…">
          Save &amp; publish
        </PendingButton>
        <PendingButton type="button" variant="outline" pending={pending} onClick={submit(false)}>
          Save as draft
        </PendingButton>
      </div>
    </form>
  );
}
