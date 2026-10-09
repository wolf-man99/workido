"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/marketplace";
import { fail, fromDbError, ok, type ActionResult } from "./result";

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (ids && ids.some((id) => !uuid.safeParse(id).success)) return fail("Invalid request.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_notifications_read", { p_notification_ids: ids });
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return ok(undefined, ids ? undefined : "All caught up");
}
