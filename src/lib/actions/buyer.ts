"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/marketplace";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

const serviceOrderSchema = z.object({
  serviceId: uuid,
  brief: z.string().trim().min(10, "Tell the specialist what you need (at least 10 characters)").max(5000, "Keep it under 5,000 characters"),
});

/** Mode A: creates an order for a published gig. Price comes from the database, never the client. */
export async function createServiceOrderAction(input: { serviceId: string; brief: string }): Promise<ActionResult<{ orderId: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in to place an order.");
  if (user.accountStatus !== "active") return fail("Your account is suspended.");
  const parsed = serviceOrderSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: orderId, error } = await supabase.rpc("create_service_order", {
    p_service_id: parsed.data.serviceId,
    p_brief: parsed.data.brief,
  });
  if (error || !orderId) return fromDbError(error);

  await track("order_created", { source: "service", order_id: orderId }, user.id);
  revalidatePath("/dashboard/buyer", "layout");
  return ok({ orderId });
}

export async function toggleSavedSpecialistAction(specialistId: string, save: boolean): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in to save specialists.");
  if (!uuid.safeParse(specialistId).success) return fail("Invalid specialist.");
  if (specialistId === user.id) return fail("You can't save yourself.");
  const supabase = await createSupabaseServerClient();
  const { error } = save
    ? await supabase.from("saved_specialists").upsert({ buyer_id: user.id, specialist_id: specialistId }, { ignoreDuplicates: true })
    : await supabase.from("saved_specialists").delete().eq("buyer_id", user.id).eq("specialist_id", specialistId);
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/buyer/saved");
  return ok(undefined, save ? "Saved to your list" : "Removed from your list");
}
