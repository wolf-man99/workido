import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";

/** Uniform return type for server actions consumed by client forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail("Please fix the highlighted fields.", fieldErrors);
}

/**
 * Database functions raise human-readable messages with specific SQLSTATE
 * codes (23514 business rule, 42501 permission, P0002 not found). Those are
 * safe to show. Anything else is logged server-side and replaced with a
 * generic message so internals never leak to the browser.
 */
const USER_FACING_CODES = new Set(["23514", "42501", "P0002", "22023"]);

export function fromDbError(error: PostgrestError | null | undefined, fallback = "Something went wrong. Please try again."): ActionResult<never> {
  if (!error) return fail(fallback);
  // CHECK constraint violations share SQLSTATE 23514 but carry technical text.
  if (/violates (check|foreign key|not-null) constraint/i.test(error.message)) {
    return fail("Some details are missing or invalid. Please review the form and try again.");
  }
  if (error.code && USER_FACING_CODES.has(error.code) && error.message) {
    return fail(error.message);
  }
  if (error.code === "23505") {
    return fail("That already exists.");
  }
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return fail("You don't have permission to do that.");
  }
  console.error("[db]", error.code, error.message);
  return fail(fallback);
}
