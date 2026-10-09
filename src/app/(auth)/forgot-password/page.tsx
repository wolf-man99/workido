import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">Enter your email and we&apos;ll send you a secure reset link.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand-text hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
