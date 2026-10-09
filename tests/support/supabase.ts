/**
 * Integration-test helpers. Run against the LOCAL Supabase stack only
 * (`npx supabase start`). Refuses to run against a non-local URL so tests
 * can never touch production data.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(url)) {
  throw new Error(`Integration tests only run against a local Supabase instance (got ${url}).`);
}
if (!anonKey || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY for the local stack in .env.local.");
}

export type Client = SupabaseClient<Database>;

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

export const service: Client = createClient<Database>(url, serviceKey, noSession);

export function anonClient(): Client {
  return createClient<Database>(url, anonKey, noSession);
}

export interface TestUser {
  id: string;
  email: string;
  client: Client;
}

const PASSWORD = "Test-password-123";

export async function createTestUser(role: "buyer" | "specialist" = "buyer", name = "Test User"): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, initial_role: role },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function makeAdmin(user: TestUser) {
  const { error } = await service.from("user_roles").insert({ user_id: user.id, role: "admin" });
  if (error) throw error;
}

export async function categoryId(slug = "graphic-design"): Promise<string> {
  const { data, error } = await service.from("categories").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id;
}

export async function skillId(slug: string): Promise<string> {
  const { data, error } = await service.from("skills").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id;
}

/** A published specialist with one published service. */
export async function createPublishedSpecialist(options: { price?: number; deliveryHours?: number; revisions?: number; skills?: string[] } = {}) {
  const user = await createTestUser("specialist", "Spec Ialist");
  const skills = options.skills ?? ["instagram-carousels", "canva"];
  for (const slug of skills) {
    const { error } = await user.client.from("specialist_skills").insert({ specialist_id: user.id, skill_id: await skillId(slug) });
    if (error) throw error;
  }
  const { error: catError } = await user.client
    .from("specialist_categories")
    .insert({ specialist_id: user.id, category_id: await categoryId() });
  if (catError) throw catError;
  const { error: profileError } = await user.client
    .from("specialist_profiles")
    .update({
      headline: "Social media designer for growing brands",
      professional_bio: "I design scroll-stopping carousels and social creatives for D2C brands and startups.",
      experience_level: "intermediate",
      is_published: true,
    })
    .eq("user_id", user.id);
  if (profileError) throw profileError;

  const { data: serviceRow, error: serviceError } = await user.client
    .from("services")
    .insert({
      specialist_id: user.id,
      category_id: await categoryId(),
      title: "Instagram carousel design",
      description: "One carousel of up to eight slides designed to match your brand guidelines.",
      deliverables: "Up to 8 slides as PNG plus source file",
      price_minor: options.price ?? 150000,
      delivery_time_hours: options.deliveryHours ?? 48,
      included_revisions: options.revisions ?? 1,
      publication_status: "published",
    })
    .select("id, slug")
    .single();
  if (serviceError) throw serviceError;
  return { user, serviceId: serviceRow.id, serviceSlug: serviceRow.slug };
}

/** Simulates verified payment the way trusted server code does (service role). */
export async function markOrderPaid(orderId: string) {
  const { data: order } = await service.from("orders").select("total_minor, currency").eq("id", orderId).single();
  const { data: payment, error } = await service
    .from("payments")
    .insert({
      order_id: orderId,
      provider: "dev",
      provider_order_id: `dev_order_${randomUUID()}`,
      amount_minor: order!.total_minor!,
      currency: order!.currency,
      idempotency_key: randomUUID(),
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: applyError } = await service.rpc("apply_payment_success", {
    p_payment_id: payment.id,
    p_provider_payment_id: `dev_pay_${randomUUID()}`,
  });
  if (applyError) throw applyError;
  return payment.id;
}

export async function addLinkDeliverable(specialist: TestUser, orderId: string) {
  const { error } = await specialist.client.from("order_deliverables").insert({
    order_id: orderId,
    uploaded_by: specialist.id,
    kind: "link",
    external_url: "https://example.com/final-design",
    filename: "Final design (Figma)",
  });
  if (error) throw error;
}
