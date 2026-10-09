import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface CurrentUser {
  id: string;
  email: string | null;
  username: string;
  fullName: string;
  avatarPath: string | null;
  accountStatus: Database["public"]["Enums"]["account_status"];
  roles: AppRole[];
  isBuyer: boolean;
  isSpecialist: boolean;
  isAdmin: boolean;
}

/**
 * Resolves the signed-in user once per request (React cache). The JWT is
 * verified by supabase.auth.getClaims(); profile and roles come from the
 * database under RLS. Returns only the narrow fields the UI needs.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_path, account_status").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile) return null;

  const roles = (roleRows ?? []).map((row) => row.role);
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return {
    id: profile.id,
    email,
    username: profile.username,
    fullName: profile.full_name,
    avatarPath: profile.avatar_path,
    accountStatus: profile.account_status,
    roles,
    isBuyer: roles.includes("buyer"),
    isSpecialist: roles.includes("specialist"),
    isAdmin: roles.includes("admin"),
  };
});

/** For private pages: redirects to login when signed out. */
export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return user;
}

/** For pages that perform actions: suspended accounts are sent to an explanation page. */
export async function requireActiveUser(nextPath?: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (user.accountStatus !== "active") redirect("/account-suspended");
  return user;
}

export async function requireSpecialist(): Promise<CurrentUser> {
  const user = await requireActiveUser("/dashboard/specialist");
  if (!user.isSpecialist) redirect("/dashboard?enable=specialist");
  return user;
}

/** Admin pages 404 for everyone else (no hint that the area exists). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin || user.accountStatus !== "active") notFound();
  return user;
}
