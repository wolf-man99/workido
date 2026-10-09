import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in via /auth/callback before landing here.
  const user = await getCurrentUser();
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">Choose a new password</h1>
      {user ? (
        <>
          <p className="mb-6 mt-1 text-sm text-ink-soft">Signed in as {user.email ?? user.username}.</p>
          <ResetPasswordForm />
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <Alert tone="warning">This reset link is invalid or has expired.</Alert>
          <Link href="/forgot-password" className="text-sm font-semibold text-brand-text hover:underline">
            Request a new reset link
          </Link>
        </div>
      )}
    </div>
  );
}
