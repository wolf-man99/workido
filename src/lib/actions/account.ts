"use server";

import { cookies } from "next/headers";
import { track } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAccountSchema } from "@/lib/validation/account";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function removeOwnFolder(supabase: ServerClient, bucket: "avatars" | "portfolio", userId: string) {
  const { data } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
  const paths = (data ?? []).filter((file) => file.id).map((file) => `${userId}/${file.name}`);
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}

/**
 * Deletes the signed-in user's account (buyers and specialists alike).
 * The database decides between erasing it (no order history) and
 * anonymising it (orders stay for the other party); see migration
 * 20261010000200_account_deletion.sql.
 */
export async function deleteAccountAction(input: { confirmation: string }): Promise<ActionResult<undefined>> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again to delete your account.");

  const supabase = await createSupabaseServerClient();
  const { data: blocker, error: checkError } = await supabase.rpc("account_deletion_blocker");
  if (checkError) return fromDbError(checkError);
  if (blocker) return fail(blocker);

  // Attachments of tasks that will be deleted (no order) have to go first:
  // storage only lets the owner remove them while the task still exists.
  const [{ data: requirements }, { data: hiredRows }] = await Promise.all([
    supabase.from("requirements").select("id").eq("buyer_id", user.id),
    supabase.from("orders").select("requirement_id").eq("buyer_id", user.id).not("requirement_id", "is", null),
  ]);
  const hired = new Set((hiredRows ?? []).map((row) => row.requirement_id));
  const deletable = (requirements ?? []).map((row) => row.id).filter((id) => !hired.has(id));
  if (deletable.length) {
    const { data: attachments } = await supabase.from("requirement_attachments").select("storage_path").in("requirement_id", deletable);
    const paths = (attachments ?? []).map((row) => row.storage_path);
    if (paths.length) await supabase.storage.from("requirement-files").remove(paths);
  }

  await track("account_deleted", { buyer: user.isBuyer, specialist: user.isSpecialist });

  const { error } = await supabase.rpc("delete_my_account", { p_confirmation: parsed.data.confirmation });
  if (error) return fromDbError(error, "We couldn't delete your account. Please try again.");

  // Profile photo and portfolio images live in the user's own public folders;
  // the current token can still remove them.
  await Promise.allSettled([removeOwnFolder(supabase, "avatars", user.id), removeOwnFolder(supabase, "portfolio", user.id)]);

  await supabase.auth.signOut().catch(() => undefined);
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (/^sb-.+-auth-token/.test(cookie.name)) cookieStore.delete(cookie.name);
  }
  return ok(undefined);
}
