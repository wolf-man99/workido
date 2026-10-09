import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/feedback";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? safeNextPath(searchParams.next) : undefined;
  const authError = searchParams.error === "link";

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">Log in to manage your tasks and orders.</p>
      {authError ? (
        <Alert tone="warning" className="mb-4">
          That link is invalid or has expired. Log in, or request a new link.
        </Alert>
      ) : null}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        New to Workido?{" "}
        <Link href="/signup" className="font-semibold text-brand-text hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
