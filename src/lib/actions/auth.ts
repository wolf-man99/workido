"use server";

import { redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/config/public-env";
import { track } from "@/lib/analytics/track";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";
import { fail, fromZodError, ok, type ActionResult } from "./result";

function appUrl() {
  return getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

export async function signUpAction(input: SignUpInput): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { fullName, email, password, role } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The database trigger only honours "buyer" or "specialist" here;
      // admin can never be requested at sign-up.
      data: { full_name: fullName, initial_role: role },
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(role === "specialist" ? "/dashboard/specialist/profile" : "/dashboard/buyer")}`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || /already registered/i.test(error.message)) {
      return fail("An account with this email already exists. Try logging in or resetting your password.");
    }
    if (error.code === "weak_password") return fail("Please choose a stronger password.");
    if (error.status === 429) return fail("Too many attempts. Please wait a minute and try again.");
    console.error("[auth] sign-up failed", error.code);
    return fail("We couldn't create your account. Please try again.");
  }

  // With email confirmation enabled Supabase returns a user with no
  // identities for an existing email (to prevent account enumeration).
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return fail("An account with this email already exists. Try logging in or resetting your password.");
  }

  // Without a session (email confirmation pending) the event is recorded anonymously.
  await track("signup_completed", { role });
  return ok({ needsConfirmation: !data.session });
}

export async function signInAction(input: SignInInput): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return fail("Please confirm your email address first. Check your inbox for the confirmation link.");
    }
    if (error.status === 429) return fail("Too many attempts. Please wait a minute and try again.");
    // Same message for unknown email and wrong password (no enumeration).
    return fail("Incorrect email or password.");
  }
  return ok({ redirectTo: safeNextPath(parsed.data.next) });
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(input: { email: string }): Promise<ActionResult<undefined>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
  });
  if (error && error.status === 429) return fail("Too many requests. Please wait a minute and try again.");
  if (error) console.error("[auth] reset request failed", error.code);
  // Always respond the same way so the form can't be used to discover accounts.
  return ok(undefined, "If an account exists for that email, a reset link is on its way.");
}

export async function updatePasswordAction(input: { password: string; confirmPassword: string }): Promise<ActionResult<undefined>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return fail("Your reset link has expired. Request a new one.");
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("Choose a password you haven't used before.");
    return fail("We couldn't update your password. Request a new reset link and try again.");
  }
  return ok(undefined, "Password updated.");
}
