import type { BadgeProps } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";

export function accountStatusTone(status: Database["public"]["Enums"]["account_status"]): BadgeProps["tone"] {
  if (status === "active") return "success";
  if (status === "suspended") return "danger";
  return "neutral";
}
