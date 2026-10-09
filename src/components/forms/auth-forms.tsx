"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, MailCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/submit-button";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/lib/actions/auth";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";
import { cn } from "@/lib/utils";
import type { z } from "zod";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "", next } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signInAction(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(result.data.redirectTo);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <FormField id="email" label="Email" error={form.formState.errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
      </FormField>
      <FormField id="password" label="Password" error={form.formState.errors.password?.message}>
        {(field) => <Input {...field} type="password" autoComplete="current-password" {...form.register("password")} />}
      </FormField>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-text hover:underline">
          Forgot password?
        </Link>
      </div>
      <PendingButton type="submit" size="lg" pending={pending} pendingLabel="Logging in…">
        Log in
      </PendingButton>
    </form>
  );
}

const roleOptions = [
  { value: "buyer", title: "I want to hire", body: "Post tasks and buy gigs", icon: ShoppingBag },
  { value: "specialist", title: "I want to work", body: "Offer services and earn", icon: Briefcase },
] as const;

export function SignUpForm({ defaultRole }: { defaultRole: "buyer" | "specialist" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const router = useRouter();
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", role: defaultRole },
  });
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof SignUpInput, { message });
          }
        }
        return;
      }
      if (result.data.needsConfirmation) {
        setConfirmationSentTo(values.email);
      } else {
        toast.success("Welcome to Workido!");
        router.replace(values.role === "specialist" ? "/dashboard/specialist/profile" : "/dashboard/buyer");
        router.refresh();
      }
    });
  });

  if (confirmationSentTo) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-text">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h2 className="font-display text-2xl font-bold">Check your inbox</h2>
        <p className="text-sm text-ink-soft">
          We sent a confirmation link to <span className="font-semibold text-ink">{confirmationSentTo}</span>. Open it to activate your account.
        </p>
        <p className="text-xs text-muted-foreground">Didn&apos;t get it? Check spam, or sign up again in a few minutes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink">How will you use Workido?</legend>
        <div className="grid grid-cols-2 gap-2">
          {roleOptions.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-2xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                role === option.value ? "border-ink bg-brand-soft" : "border-border bg-card hover:border-ink/30",
              )}
            >
              <input type="radio" value={option.value} className="sr-only" {...form.register("role")} />
              <option.icon className="size-5 text-ink" aria-hidden />
              <span className="text-sm font-bold text-ink">{option.title}</span>
              <span className="text-xs text-muted-foreground">{option.body}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">You can do both later — this just sets up your first dashboard.</p>
      </fieldset>
      <FormField id="fullName" label="Full name" error={form.formState.errors.fullName?.message}>
        {(field) => <Input {...field} autoComplete="name" {...form.register("fullName")} />}
      </FormField>
      <FormField id="email" label="Email" error={form.formState.errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
      </FormField>
      <FormField id="password" label="Password" hint="At least 8 characters, with a letter and a number." error={form.formState.errors.password?.message}>
        {(field) => <Input {...field} type="password" autoComplete="new-password" {...form.register("password")} />}
      </FormField>
      <PendingButton type="submit" size="lg" pending={pending} pendingLabel="Creating account…">
        Create account
      </PendingButton>
      <p className="text-center text-xs text-muted-foreground">
        By signing up you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (!result.ok) setError(result.error);
      else setMessage(result.message ?? "Check your inbox.");
    });
  });

  if (message) return <Alert tone="success" title="Check your inbox">{message}</Alert>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <FormField id="email" label="Email" error={form.formState.errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="email" {...form.register("email")} />}
      </FormField>
      <PendingButton type="submit" size="lg" pending={pending} pendingLabel="Sending…">
        Send reset link
      </PendingButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await updatePasswordAction(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Password updated");
      router.replace("/dashboard");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <FormField id="password" label="New password" hint="At least 8 characters, with a letter and a number." error={form.formState.errors.password?.message}>
        {(field) => <Input {...field} type="password" autoComplete="new-password" {...form.register("password")} />}
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password" error={form.formState.errors.confirmPassword?.message}>
        {(field) => <Input {...field} type="password" autoComplete="new-password" {...form.register("confirmPassword")} />}
      </FormField>
      <PendingButton type="submit" size="lg" pending={pending} pendingLabel="Saving…">
        Update password
      </PendingButton>
    </form>
  );
}
