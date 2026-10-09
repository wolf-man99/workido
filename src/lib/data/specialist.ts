import "server-only";
import { toReputation, type Reputation } from "@/lib/domain/reputation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getMySpecialistWorkspace(userId: string) {
  const supabase = await createSupabaseServerClient();
  const [profile, skills, categories, portfolio, services, verification] = await Promise.all([
    supabase.from("specialist_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("specialist_skills").select("skill_id").eq("specialist_id", userId),
    supabase.from("specialist_categories").select("category_id").eq("specialist_id", userId),
    supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("specialist_id", userId),
    supabase.from("services").select("id, publication_status").eq("specialist_id", userId),
    supabase
      .from("verification_requests")
      .select("status, decision_note, submitted_at, reviewed_at")
      .eq("specialist_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  return {
    profile: profile.data,
    skillIds: (skills.data ?? []).map((row) => row.skill_id),
    categoryIds: (categories.data ?? []).map((row) => row.category_id),
    portfolioCount: portfolio.count ?? 0,
    services: services.data ?? [],
    latestVerification: verification.data,
  };
}

export type SpecialistWorkspace = Awaited<ReturnType<typeof getMySpecialistWorkspace>>;

/** Onboarding checklist derived from real profile data. */
export function onboardingSteps(workspace: SpecialistWorkspace) {
  const p = workspace.profile;
  return [
    { key: "headline", label: "Write a headline and professional bio", done: Boolean(p?.headline && (p.professional_bio?.length ?? 0) >= 50), href: "/dashboard/specialist/profile" },
    { key: "skills", label: "Add your skills and categories", done: workspace.skillIds.length > 0 && workspace.categoryIds.length > 0, href: "/dashboard/specialist/profile" },
    { key: "portfolio", label: "Add portfolio evidence", done: workspace.portfolioCount > 0, href: "/dashboard/specialist/portfolio" },
    { key: "service", label: "Publish your first service", done: workspace.services.some((s) => s.publication_status === "published"), href: "/dashboard/specialist/services/new" },
    { key: "publish", label: "Publish your profile", done: Boolean(p?.is_published), href: "/dashboard/specialist/profile" },
  ];
}

export async function listMyServices(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, slug, title, price_minor, currency, delivery_time_hours, included_revisions, publication_status, moderation_note, updated_at, categories(name)")
    .eq("specialist_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMyService(userId: string, serviceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("services").select("*").eq("id", serviceId).eq("specialist_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMyPortfolio(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("id, title, description, asset_path, external_url, visibility, created_at, categories(name)")
    .eq("specialist_id", userId)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPublicSpecialistProfile(username: string) {
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_path, bio, city, region, country_code, website_url, is_sample, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const { data: specialist } = await supabase.from("specialist_profiles").select("*").eq("user_id", profile.id).maybeSingle();
  // RLS hides unpublished specialist profiles from everyone but the owner/admins.
  if (!specialist) return null;

  const [skills, categories, portfolio, reviews, reputation] = await Promise.all([
    supabase.from("specialist_skills").select("skills(name, slug)").eq("specialist_id", profile.id),
    supabase.from("specialist_categories").select("categories(name, slug)").eq("specialist_id", profile.id),
    supabase
      .from("portfolio_items")
      .select("id, title, description, asset_path, external_url, categories(name)")
      .eq("specialist_id", profile.id)
      .eq("visibility", "public")
      .order("sort_order")
      .limit(12),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, order_id, reviewer:profiles!reviews_reviewer_id_fkey(full_name)")
      .eq("reviewee_id", profile.id)
      .eq("reviewee_role", "specialist")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.rpc("get_specialist_reputation", { p_specialist_id: profile.id }).single(),
  ]);

  const rep: Reputation | null = reputation.data ? toReputation(reputation.data) : null;

  return {
    profile,
    specialist,
    skills: (skills.data ?? []).flatMap((row) => (row.skills ? [row.skills] : [])),
    categories: (categories.data ?? []).flatMap((row) => (row.categories ? [row.categories] : [])),
    portfolio: portfolio.data ?? [],
    reviews: reviews.data ?? [],
    reputation: rep,
  };
}

export async function isSpecialistSaved(buyerId: string, specialistId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("saved_specialists").select("specialist_id").eq("buyer_id", buyerId).eq("specialist_id", specialistId).maybeSingle();
  return Boolean(data);
}
