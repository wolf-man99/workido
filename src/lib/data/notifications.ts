import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export async function listNotifications(limit = 50) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link_path, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
