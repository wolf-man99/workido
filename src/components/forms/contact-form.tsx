"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/submit-button";
import { sendContactMessageAction, type ContactInput } from "@/lib/actions/contact";

const clientSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.email("Enter a valid email address"),
  topic: z.enum(["general", "buying", "selling", "payments", "trust_safety", "other"]),
  message: z.string().trim().min(10, "Tell us a bit more (at least 10 characters)").max(4000),
  website: z.string().optional(),
});

export function ContactForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const form = useForm<ContactInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: defaultName, email: defaultEmail, topic: "general", message: "", website: "" },
  });
  const errors = form.formState.errors;

  if (result?.ok) return <Alert tone="success" title="Message sent">{result.message}</Alert>;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          const response = await sendContactMessageAction(values);
          setResult(response.ok ? { ok: true, message: response.message ?? "Thanks!" } : { ok: false, message: response.error });
        }),
      )}
    >
      {result && !result.ok ? <Alert tone="danger">{result.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contact-name" label="Name" error={errors.name?.message}>
          {(field) => <Input {...field} autoComplete="name" {...form.register("name")} />}
        </FormField>
        <FormField id="contact-email" label="Email" error={errors.email?.message}>
          {(field) => <Input {...field} type="email" autoComplete="email" {...form.register("email")} />}
        </FormField>
      </div>
      <FormField id="contact-topic" label="Topic">
        {(field) => (
          <Select {...field} {...form.register("topic")}>
            <option value="general">General question</option>
            <option value="buying">Buying / hiring</option>
            <option value="selling">Selling as a specialist</option>
            <option value="payments">Payments & refunds</option>
            <option value="trust_safety">Trust & safety</option>
            <option value="other">Something else</option>
          </Select>
        )}
      </FormField>
      <FormField id="contact-message" label="Message" hint="If it's about an order, include the order number (e.g. WK-…)." error={errors.message?.message}>
        {(field) => <Textarea {...field} rows={6} maxLength={4000} {...form.register("message")} />}
      </FormField>
      {/* Honeypot field for bots; hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" {...form.register("website")} />
      </div>
      <PendingButton type="submit" pending={pending} pendingLabel="Sending…" className="self-start">
        Send message
      </PendingButton>
    </form>
  );
}
