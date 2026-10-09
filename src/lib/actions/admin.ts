"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/marketplace";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

/**
 * Admin actions. The UI check here is a convenience: every database function
 * re-checks is_admin() and RLS restricts admin-only tables, so a non-admin
 * calling these actions directly still gets a permission error.
 */
async function admin() {
  const user = await getCurrentUser();
  return user?.isAdmin && user.accountStatus === "active" ? user : null;
}

const DENIED = "Administrator access required.";

function done(message: string) {
  revalidatePath("/admin", "layout");
  return ok(undefined, message);
}

export async function setAccountStatusAction(userId: string, status: "active" | "suspended", reason: string): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  if (!uuid.safeParse(userId).success) return fail("Invalid user.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_account_status", { p_user_id: userId, p_status: status, p_reason: reason });
  if (error) return fromDbError(error);
  return done(status === "suspended" ? "Account suspended" : "Account reactivated");
}

export async function reviewVerificationAction(requestId: string, approve: boolean, note: string): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  if (!uuid.safeParse(requestId).success) return fail("Invalid request.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_verification", { p_request_id: requestId, p_approve: approve, p_note: note });
  if (error) return fromDbError(error);
  return done(approve ? "Specialist verified" : "Verification rejected");
}

export async function moderateServiceAction(serviceId: string, remove: boolean, reason: string): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  if (!uuid.safeParse(serviceId).success) return fail("Invalid service.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_moderate_service", { p_service_id: serviceId, p_remove: remove, p_reason: reason });
  if (error) return fromDbError(error);
  revalidatePath("/gigs");
  return done(remove ? "Listing removed" : "Listing restored as unpublished");
}

export async function resolveDisputeAction(disputeId: string, outcome: "complete_order" | "refund_buyer" | "resume_work", resolution: string): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  if (!uuid.safeParse(disputeId).success) return fail("Invalid dispute.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resolve_dispute", { p_dispute_id: disputeId, p_outcome: outcome, p_resolution: resolution });
  if (error) return fromDbError(error);
  return done("Dispute resolved");
}

export async function markPayoutAction(orderId: string, reference: string): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  if (!uuid.safeParse(orderId).success) return fail("Invalid order.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_mark_payout", { p_order_id: orderId, p_reference: reference });
  if (error) return fromDbError(error);
  return done("Payout recorded");
}

export async function reviewReportAction(reportId: string, status: "reviewed" | "dismissed"): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  if (!uuid.safeParse(reportId).success) return fail("Invalid report.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_report", { p_report_id: reportId, p_status: status });
  if (error) return fromDbError(error);
  return done(status === "reviewed" ? "Marked as reviewed" : "Report dismissed");
}

export async function resolveContactMessageAction(messageId: string): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  if (!uuid.safeParse(messageId).success) return fail("Invalid message.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contact_messages").update({ status: "resolved" }).eq("id", messageId);
  if (error) return fromDbError(error);
  return done("Marked as resolved");
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(300),
  icon: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[a-z0-9-]{1,40}$/.test(value), "Use a lowercase icon key"),
  parentId: z.union([uuid, z.literal("")]),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean(),
});

export type CategoryInput = z.input<typeof categorySchema>;

export async function saveCategoryAction(categoryId: string | null, input: CategoryInput): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail(DENIED);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (categoryId && parsed.data.parentId === categoryId) return fail("A category can't be its own parent.");
  const row = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    icon: parsed.data.icon || null,
    parent_id: parsed.data.parentId || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  };
  const supabase = await createSupabaseServerClient();
  const { error } = categoryId ? await supabase.from("categories").update(row).eq("id", categoryId) : await supabase.from("categories").insert(row);
  if (error?.code === "23505") return fail("That slug is already used.", { slug: "Slug already used" });
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return done(categoryId ? "Category updated" : "Category created");
}
