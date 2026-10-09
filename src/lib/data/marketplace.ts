import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
}

/** Active categories (RLS hides inactive ones from non-admins). */
export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, icon, parent_id, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listTopLevelCategories(): Promise<CategoryRow[]> {
  return (await listCategories()).filter((category) => category.parent_id === null);
}

export async function getCategoryBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, icon, parent_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface SkillRow {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
}

export async function listSkills(): Promise<SkillRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("skills").select("id, name, slug, category_id").eq("is_active", true).order("name");
  if (error) throw error;
  return data;
}

export type ServiceSort = "recommended" | "price_asc" | "price_desc" | "delivery" | "rating" | "newest";

export interface ServiceSearchParams {
  category?: string;
  q?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  maxDeliveryHours?: number;
  minRating?: number;
  availability?: Enums["availability_status"];
  skill?: string;
  specialistId?: string;
  sort?: ServiceSort;
  page?: number;
  pageSize?: number;
}

export type ServiceListing = Database["public"]["Functions"]["search_services"]["Returns"][number];

export async function searchServices(params: ServiceSearchParams): Promise<{ items: ServiceListing[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const pageSize = params.pageSize ?? 12;
  const page = Math.max(1, params.page ?? 1);
  const { data, error } = await supabase.rpc("search_services", {
    p_category_slug: params.category,
    p_query: params.q,
    p_min_price_minor: params.minPriceMinor,
    p_max_price_minor: params.maxPriceMinor,
    p_max_delivery_hours: params.maxDeliveryHours,
    p_min_rating: params.minRating,
    p_availability: params.availability,
    p_skill_slug: params.skill,
    p_specialist_id: params.specialistId,
    p_sort: params.sort ?? "recommended",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  return { items: data ?? [], total: Number(data?.[0]?.total_count ?? 0) };
}

export type SpecialistSort = "recommended" | "price_asc" | "rating" | "newest";

export interface SpecialistSearchParams {
  q?: string;
  skill?: string;
  category?: string;
  availability?: Enums["availability_status"];
  maxStartingPriceMinor?: number;
  experience?: Enums["experience_level"];
  minRating?: number;
  sort?: SpecialistSort;
  page?: number;
  pageSize?: number;
}

export type SpecialistListing = Database["public"]["Functions"]["search_specialists"]["Returns"][number];

export async function searchSpecialists(params: SpecialistSearchParams): Promise<{ items: SpecialistListing[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const pageSize = params.pageSize ?? 12;
  const page = Math.max(1, params.page ?? 1);
  const { data, error } = await supabase.rpc("search_specialists", {
    p_query: params.q,
    p_skill_slug: params.skill,
    p_category_slug: params.category,
    p_availability: params.availability,
    p_max_starting_price_minor: params.maxStartingPriceMinor,
    p_experience: params.experience,
    p_min_rating: params.minRating,
    p_sort: params.sort ?? "recommended",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  return { items: data ?? [], total: Number(data?.[0]?.total_count ?? 0) };
}
