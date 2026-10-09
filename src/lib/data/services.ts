import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Public gig detail. RLS only returns published listings of public specialists (or the owner's own). */
export async function getServiceBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: service, error } = await supabase
    .from("services")
    .select(
      "id, slug, title, description, deliverables, buyer_instructions, price_minor, currency, delivery_time_hours, included_revisions, publication_status, specialist_id, category_id, published_at, categories(name, slug)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!service) return null;

  const [profile, specialist, portfolio, reviews] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_path, city, is_sample").eq("id", service.specialist_id).maybeSingle(),
    supabase
      .from("specialist_profiles")
      .select("headline, availability_status, verification_status, rating_avg, rating_count, completed_orders_count, experience_level, is_published")
      .eq("user_id", service.specialist_id)
      .maybeSingle(),
    supabase
      .from("portfolio_items")
      .select("id, title, asset_path, external_url, category_id")
      .eq("specialist_id", service.specialist_id)
      .eq("visibility", "public")
      .order("sort_order")
      .limit(8),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name)")
      .eq("reviewee_id", service.specialist_id)
      .eq("reviewee_role", "specialist")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (!profile.data || !specialist.data) return null;
  const relevantPortfolio = (portfolio.data ?? [])
    .slice()
    .sort((a, b) => Number(b.category_id === service.category_id) - Number(a.category_id === service.category_id))
    .slice(0, 4);

  return { service, specialistProfile: profile.data, specialist: specialist.data, portfolio: relevantPortfolio, reviews: reviews.data ?? [] };
}
