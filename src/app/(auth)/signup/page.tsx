import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage(props: PageProps<"/signup">) {
  const searchParams = await props.searchParams;
  const defaultRole = searchParams.role === "specialist" ? "specialist" : "buyer";

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">Free to join. No identity documents needed to get started.</p>
      <SignUpForm defaultRole={defaultRole} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-text hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
