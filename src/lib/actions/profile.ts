"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { inspectUploadedObject } from "@/lib/storage/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileSchema, settingsSchema, type ProfileInput, type SettingsInput } from "@/lib/validation/profile";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      username: parsed.data.username,
      bio: parsed.data.bio,
      city: parsed.data.city,
      region: parsed.data.region,
      country_code: parsed.data.countryCode,
      website_url: parsed.data.websiteUrl,
    })
    // RLS also restricts updates to the owner; this is defence in depth.
    .eq("id", user.id);
  if (error?.code === "23505") return fail("That username is taken.", { username: "That username is taken" });
  if (error) return fromDbError(error);

  revalidatePath("/", "layout");
  return ok(undefined, "Profile saved");
}

export async function updateSettingsAction(input: SettingsInput): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_settings")
    .update({
      email_notifications: parsed.data.emailNotifications,
      marketing_emails: parsed.data.marketingEmails,
      whatsapp_opt_in: parsed.data.whatsappOptIn,
      phone: parsed.data.phone,
    })
    .eq("user_id", user.id);
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/settings");
  return ok(undefined, "Preferences saved");
}

export async function setAvatarAction(input: { path: string }): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (!input.path.startsWith(`${user.id}/`)) return fail("Invalid upload.");

  const supabase = await createSupabaseServerClient();
  const inspected = await inspectUploadedObject(supabase, "avatar", input.path);
  if (!inspected.ok) return fail(inspected.error);

  const previous = user.avatarPath;
  const { error } = await supabase.from("profiles").update({ avatar_path: input.path }).eq("id", user.id);
  if (error) return fromDbError(error);
  if (previous && previous !== input.path) {
    await supabase.storage.from("avatars").remove([previous]);
  }
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function removeAvatarAction(): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  const supabase = await createSupabaseServerClient();
  if (user.avatarPath) await supabase.storage.from("avatars").remove([user.avatarPath]);
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return ok(undefined, "Photo removed");
}

/** Enables the specialist capability, then sends the user to onboarding. */
export async function becomeSpecialistAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("become_specialist");
  if (error) {
    console.error("[profile] become_specialist failed", error.code);
    redirect("/dashboard?enable=specialist&error=1");
  }
  revalidatePath("/", "layout");
  redirect("/dashboard/specialist/profile");
}

export async function enableBuyerAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createSupabaseServerClient();
  await supabase.from("user_roles").upsert({ user_id: user.id, role: "buyer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  revalidatePath("/", "layout");
  redirect("/dashboard/buyer");
}
