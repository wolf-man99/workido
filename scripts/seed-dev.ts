/**
 * Development seed for Workido.
 *
 *   npm run seed:dev
 *
 * Creates clearly fictional sample users (flagged profiles.is_sample, emails
 * on the reserved .test TLD), services, portfolio artwork, requirements and
 * a few completed orders so every screen has something to show.
 *
 * Safety:
 *  - Refuses to run when NODE_ENV=production.
 *  - Refuses to run against a non-local Supabase URL unless
 *    ALLOW_REMOTE_DEV_SEED=true is set explicitly (for a dedicated dev project).
 *  - Idempotent: existing sample users/services are reused, not duplicated.
 *  - Never touches non-sample data. Migrations never contain sample data.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import type { Database } from "../src/lib/supabase/database.types";
import { placeholderArtwork } from "./lib/png";

config({ path: ".env.local", quiet: true });

type Client = SupabaseClient<Database>;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SAMPLE_PASSWORD = process.env.SEED_SAMPLE_PASSWORD ?? "Workido-sample-2026";

function guard() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production.");
  }
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  }
  const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL);
  if (!isLocal && process.env.ALLOW_REMOTE_DEV_SEED !== "true") {
    throw new Error(
      `Refusing to seed remote project ${SUPABASE_URL}. Set ALLOW_REMOTE_DEV_SEED=true only for a dedicated development project.`,
    );
  }
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;
const admin: Client = createClient<Database>(SUPABASE_URL, SERVICE_KEY, noSession);

type DbResponse = { data: unknown; error: { message: string } | null };
type SuccessData<R extends DbResponse> = NonNullable<Extract<R, { error: null }>["data"]>;

async function must<R extends DbResponse>(promise: PromiseLike<R>, label: string): Promise<SuccessData<R>> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as SuccessData<R>;
}

interface SampleUser {
  handle: string;
  name: string;
  role: "buyer" | "specialist";
  city?: string;
}

async function ensureUser(user: SampleUser): Promise<{ id: string; client: Client }> {
  const email = `${user.handle}@sample.workido.test`;
  const existing = await admin.from("profiles").select("id").eq("username", user.handle).maybeSingle();
  let id = existing.data?.id;
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: SAMPLE_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.name, initial_role: user.role },
    });
    if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
    id = data.user.id;
    await must(
      admin.from("profiles").update({ username: user.handle, is_sample: true, city: user.city ?? null, country_code: "IN" }).eq("id", id),
      "flag sample profile",
    );
  }
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: SAMPLE_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return { id, client };
}

const PALETTES: [string, string, string][] = [
  ["FFE7DC", "FF6B35", "171717"],
  ["FFF4D6", "FFD166", "FF6B35"],
  ["DDF6EA", "35C98A", "171717"],
  ["F1F2F4", "171717", "FFD166"],
  ["171717", "FF6B35", "FFFDF8"],
];

interface SampleService {
  title: string;
  category: string;
  description: string;
  deliverables: string;
  instructions?: string;
  priceRupees: number;
  deliveryHours: number;
  revisions: number;
}

interface SampleSpecialist extends SampleUser {
  headline: string;
  bio: string;
  experience: "entry" | "intermediate" | "expert";
  availability: "available" | "busy" | "unavailable";
  skills: string[];
  categories: string[];
  verified: boolean;
  services: SampleService[];
}

const SPECIALISTS: SampleSpecialist[] = [
  {
    handle: "sample-aarav-designs",
    name: "Aarav Mehta",
    role: "specialist",
    city: "Sample City",
    headline: "Social media designer for D2C and lifestyle brands",
    bio: "Fictional sample profile. Designs scroll-stopping Instagram carousels, story sets and ad creatives that stay on brand. Works from your brand kit and references.",
    experience: "intermediate",
    availability: "available",
    skills: ["instagram-carousels", "social-media-creatives", "canva", "adobe-photoshop"],
    categories: ["graphic-design"],
    verified: true,
    services: [
      {
        title: "Instagram carousel design",
        category: "social-media-creatives",
        description: "A polished Instagram carousel of up to eight slides, designed around your message and brand guidelines. Great for launches, explainers and educational posts.",
        deliverables: "One carousel with up to 8 slides (1080×1350 PNG) plus editable source file.",
        instructions: "Share your copy (or key points), brand colours/fonts, logo and any reference posts you like.",
        priceRupees: 1500,
        deliveryHours: 48,
        revisions: 1,
      },
      {
        title: "YouTube thumbnail design (set of 3)",
        category: "thumbnails",
        description: "Three bold, high-contrast thumbnail options for a single video, optimised to stay readable at small sizes on mobile.",
        deliverables: "3 thumbnail concepts (1280×720 PNG); final chosen design in source format.",
        priceRupees: 1200,
        deliveryHours: 24,
        revisions: 2,
      },
    ],
  },
  {
    handle: "sample-kavya-edits",
    name: "Kavya Iyer",
    role: "specialist",
    city: "Sample City",
    headline: "Short-form video editor for Reels and Shorts",
    bio: "Fictional sample profile. Turns raw footage into punchy short-form edits with captions, pacing and hooks designed for retention on Reels and Shorts.",
    experience: "expert",
    availability: "available",
    skills: ["short-form-video-editing", "subtitles-captions", "adobe-premiere-pro", "motion-graphics"],
    categories: ["video-editing"],
    verified: false,
    services: [
      {
        title: "Short-form video editing (Reels / Shorts)",
        category: "short-form-video",
        description: "Edit up to 60 seconds of vertical video with hook-first pacing, burned-in captions, music and simple motion text.",
        deliverables: "One 9:16 MP4 up to 60 seconds with captions; project file on request.",
        instructions: "Upload raw clips (or a drive link), your script or talking points and any brand fonts.",
        priceRupees: 2000,
        deliveryHours: 72,
        revisions: 2,
      },
    ],
  },
  {
    handle: "sample-rohan-ads",
    name: "Rohan Kapoor",
    role: "specialist",
    city: "Sample City",
    headline: "Performance marketer: Google & Meta Ads",
    bio: "Fictional sample profile. Sets up and audits paid campaigns for small businesses, with clear reports and practical next steps rather than jargon.",
    experience: "expert",
    availability: "busy",
    skills: ["meta-ads", "google-ads", "ad-account-audits", "conversion-tracking"],
    categories: ["performance-marketing"],
    verified: true,
    services: [
      {
        title: "Meta Ads account audit",
        category: "meta-ads",
        description: "A structured audit of your Meta Ads account covering campaign structure, audiences, creatives, tracking and budget allocation, with prioritised fixes.",
        deliverables: "Audit report (PDF) with findings, priority list and a 30-minute walkthrough call.",
        instructions: "Grant analyst access to your ad account and share your main business goal.",
        priceRupees: 4000,
        deliveryHours: 72,
        revisions: 1,
      },
      {
        title: "Google Ads search campaign setup",
        category: "google-ads",
        description: "Keyword research, ad groups, responsive search ads and conversion tracking for one search campaign, ready to launch.",
        deliverables: "One live-ready search campaign with up to 3 ad groups and setup notes.",
        priceRupees: 6000,
        deliveryHours: 96,
        revisions: 1,
      },
    ],
  },
  {
    handle: "sample-meera-writes",
    name: "Meera Nair",
    role: "specialist",
    city: "Sample City",
    headline: "Conversion copywriter for landing pages",
    bio: "Fictional sample profile. Writes clear, benefit-led landing page copy and LinkedIn posts for SaaS and service businesses.",
    experience: "intermediate",
    availability: "available",
    skills: ["landing-page-copywriting", "linkedin-content", "ad-copywriting"],
    categories: ["content-writing"],
    verified: false,
    services: [
      {
        title: "Landing-page copywriting",
        category: "content-writing",
        description: "Complete copy for one landing page: hero, benefits, social proof prompts, FAQs and calls to action, written for your audience.",
        deliverables: "Copy document for one landing page (up to 800 words) with headline options.",
        instructions: "Share your product, audience, offer and any existing copy or competitors you admire.",
        priceRupees: 3500,
        deliveryHours: 72,
        revisions: 2,
      },
    ],
  },
  {
    handle: "sample-dev-analytics",
    name: "Dev Sharma",
    role: "specialist",
    city: "Sample City",
    headline: "GA4 & Google Tag Manager specialist",
    bio: "Fictional sample profile. Fixes broken tracking, configures GA4 events and conversions, and documents everything so your team can maintain it.",
    experience: "expert",
    availability: "available",
    skills: ["ga4-configuration", "google-tag-manager", "conversion-tracking", "looker-studio"],
    categories: ["analytics-tracking"],
    verified: false,
    services: [
      {
        title: "GA4 event configuration",
        category: "analytics-tracking",
        description: "Configure up to 10 GA4 events and key conversions through Google Tag Manager, tested in preview mode and documented.",
        deliverables: "Configured GTM container, GA4 events/conversions and a tracking plan document.",
        instructions: "Provide GTM and GA4 access plus the actions you want to track.",
        priceRupees: 3000,
        deliveryHours: 48,
        revisions: 1,
      },
    ],
  },
  {
    handle: "sample-isha-decks",
    name: "Isha Verma",
    role: "specialist",
    city: "Sample City",
    headline: "Presentation designer for pitch and sales decks",
    bio: "Fictional sample profile. Turns dense content into clean, persuasive slides for investor pitches and sales conversations.",
    experience: "intermediate",
    availability: "unavailable",
    skills: ["pitch-deck-design", "powerpoint", "google-slides"],
    categories: ["presentations"],
    verified: false,
    services: [
      {
        title: "Presentation design (up to 12 slides)",
        category: "presentations",
        description: "Redesign up to 12 slides into a consistent, on-brand deck with clear hierarchy, charts and icons.",
        deliverables: "Up to 12 designed slides in PowerPoint or Google Slides plus PDF export.",
        priceRupees: 2500,
        deliveryHours: 72,
        revisions: 2,
      },
    ],
  },
];

const BUYERS: SampleUser[] = [
  { handle: "sample-buyer-nisha", name: "Nisha Rao", role: "buyer", city: "Sample City" },
  { handle: "sample-buyer-arjun", name: "Arjun Das", role: "buyer", city: "Sample City" },
];

async function lookupIds() {
  const categories = await must(admin.from("categories").select("id, slug"), "categories");
  const skills = await must(admin.from("skills").select("id, slug"), "skills");
  return {
    category: new Map(categories.map((c) => [c.slug, c.id])),
    skill: new Map(skills.map((s) => [s.slug, s.id])),
  };
}

async function main() {
  guard();
  console.log(`Seeding sample data into ${SUPABASE_URL} …`);
  const ids = await lookupIds();

  // Admin (sample) - role granted with the service role, never via sign-up.
  const adminUser = await ensureUser({ handle: "sample-admin", name: "Sample Admin", role: "buyer" });
  await admin.from("user_roles").upsert({ user_id: adminUser.id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });

  const specialists = new Map<string, { id: string; client: Client; serviceIds: string[] }>();
  let artIndex = 0;

  for (const spec of SPECIALISTS) {
    const user = await ensureUser(spec);
    const { client, id } = user;

    for (const slug of spec.skills) {
      const skillId = ids.skill.get(slug);
      if (skillId) await client.from("specialist_skills").upsert({ specialist_id: id, skill_id: skillId }, { ignoreDuplicates: true });
    }
    for (const slug of spec.categories) {
      const categoryId = ids.category.get(slug);
      if (categoryId) await client.from("specialist_categories").upsert({ specialist_id: id, category_id: categoryId }, { ignoreDuplicates: true });
    }
    await must(
      client
        .from("specialist_profiles")
        .update({ headline: spec.headline, professional_bio: spec.bio, experience_level: spec.experience, availability_status: spec.availability, is_published: true })
        .eq("user_id", id),
      `publish ${spec.handle}`,
    );

    // Portfolio: two generated abstract images per specialist.
    const { count: portfolioCount } = await client.from("portfolio_items").select("id", { count: "exact", head: true }).eq("specialist_id", id);
    if (!portfolioCount) {
      for (let i = 0; i < 2; i++) {
        const palette = PALETTES[artIndex % PALETTES.length]!;
        const png = placeholderArtwork(640, 400, palette, artIndex + 3);
        artIndex++;
        const path = `${id}/sample-${i + 1}.png`;
        const { error: uploadError } = await client.storage.from("portfolio").upload(path, png, { contentType: "image/png", upsert: true });
        if (uploadError) throw new Error(`upload portfolio: ${uploadError.message}`);
        await must(
          client.from("portfolio_items").insert({
            specialist_id: id,
            title: `Sample project ${i + 1}`,
            description: "Placeholder artwork generated for development. Not real client work.",
            category_id: ids.category.get(spec.categories[0]!) ?? null,
            asset_path: path,
            sort_order: i,
          }),
          "portfolio item",
        );
      }
    }

    // Services (idempotent by title per specialist).
    const serviceIds: string[] = [];
    for (const service of spec.services) {
      const existing = await client.from("services").select("id").eq("specialist_id", id).eq("title", service.title).maybeSingle();
      if (existing.data) {
        serviceIds.push(existing.data.id);
        continue;
      }
      const created = await must(
        client
          .from("services")
          .insert({
            specialist_id: id,
            category_id: ids.category.get(service.category)!,
            title: service.title,
            description: service.description,
            deliverables: service.deliverables,
            buyer_instructions: service.instructions ?? null,
            price_minor: service.priceRupees * 100,
            delivery_time_hours: service.deliveryHours,
            included_revisions: service.revisions,
            publication_status: "published",
          })
          .select("id")
          .single(),
        `service ${service.title}`,
      );
      serviceIds.push(created.id);
    }

    // Verification: go through the real request + admin review functions.
    if (spec.verified) {
      const { data: sp } = await admin.from("specialist_profiles").select("verification_status").eq("user_id", id).single();
      if (sp?.verification_status === "not_submitted") {
        await must(client.rpc("submit_verification_request", { p_note: "Sample verification request." }), "verification request");
      }
      const { data: pending } = await admin.from("verification_requests").select("id").eq("specialist_id", id).eq("status", "pending").maybeSingle();
      if (pending) {
        await must(adminUser.client.rpc("admin_review_verification", { p_request_id: pending.id, p_approve: true, p_note: "Sample approval." }), "approve verification");
      }
    }

    specialists.set(spec.handle, { id, client, serviceIds });
    console.log(`  ✓ specialist ${spec.handle}`);
  }

  const buyers = [];
  for (const buyer of BUYERS) {
    buyers.push(await ensureUser(buyer));
    console.log(`  ✓ buyer ${buyer.handle}`);
  }
  const [nisha, arjun] = buyers as [Awaited<ReturnType<typeof ensureUser>>, Awaited<ReturnType<typeof ensureUser>>];

  // Completed sample orders (only once) to exercise reviews and reputation.
  const { count: orderCount } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", nisha.id);
  if (!orderCount) {
    const aarav = specialists.get("sample-aarav-designs")!;
    const dev = specialists.get("sample-dev-analytics")!;
    await completeSampleOrder(nisha, aarav, aarav.serviceIds[0]!, 5, "Sample review: clear communication and the carousel matched our brand perfectly.");
    await completeSampleOrder(arjun, aarav, aarav.serviceIds[0]!, 4, "Sample review: good work, one round of tweaks and done.");
    await completeSampleOrder(nisha, dev, dev.serviceIds[0]!, 5, "Sample review: our GA4 conversions finally fire correctly.");
    // One order in progress for dashboards.
    const kavya = specialists.get("sample-kavya-edits")!;
    const { data: inProgress } = await nisha.client.rpc("create_service_order", {
      p_service_id: kavya.serviceIds[0]!,
      p_brief: "Sample order: edit a 45-second product teaser from the attached clips.",
    });
    if (inProgress) {
      await markPaid(inProgress);
      await kavya.client.rpc("perform_order_action", { p_order_id: inProgress, p_action: "accept" });
      await nisha.client.from("messages").insert({
        conversation_id: (await admin.from("conversations").select("id").eq("order_id", inProgress).single()).data!.id,
        sender_id: nisha.id,
        body: "Sample message: footage is in the shared folder. Excited to see the first cut!",
      });
    }
    console.log("  ✓ sample orders");
  }

  // An open custom requirement with an invitation and an offer.
  const { count: requirementCount } = await admin.from("requirements").select("id", { count: "exact", head: true }).eq("buyer_id", arjun.id);
  if (!requirementCount) {
    const deadline = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const requirement = await must(
      arjun.client
        .from("requirements")
        .insert({
          buyer_id: arjun.id,
          title: "Festive campaign creatives for Instagram",
          description: "Sample requirement: we need 3 static posts and 1 carousel for a festive sale campaign, following our existing brand kit.",
          category_id: ids.category.get("graphic-design")!,
          deliverables: "3 static posts (1080×1350) and 1 carousel of up to 6 slides",
          quantity: 4,
          revisions_expected: 1,
          budget_min_minor: 300000,
          budget_max_minor: 600000,
          deadline_at: deadline,
          urgency: "standard",
          status: "open",
        })
        .select("id")
        .single(),
      "requirement",
    );
    await arjun.client.from("requirement_skills").insert([
      { requirement_id: requirement.id, skill_id: ids.skill.get("social-media-creatives")!, is_mandatory: true },
      { requirement_id: requirement.id, skill_id: ids.skill.get("instagram-carousels")!, is_mandatory: false },
    ]);
    const aarav = specialists.get("sample-aarav-designs")!;
    await must(arjun.client.from("requirement_invitations").insert({ requirement_id: requirement.id, specialist_id: aarav.id }), "invitation");
    await must(
      aarav.client.from("offers").insert({
        requirement_id: requirement.id,
        specialist_id: aarav.id,
        proposed_price_minor: 450000,
        delivery_time_hours: 96,
        revisions_included: 1,
        message: "Sample offer: I can deliver all four creatives within four days using your brand kit, with one revision round.",
      }),
      "offer",
    );
    console.log("  ✓ sample requirement with offer");
  }

  console.log("\nDone. Sample accounts (development only) use the password from SEED_SAMPLE_PASSWORD (default: Workido-sample-2026):");
  console.log("  admin:      sample-admin@sample.workido.test");
  console.log("  buyers:     sample-buyer-nisha@sample.workido.test, sample-buyer-arjun@sample.workido.test");
  console.log("  specialist: sample-aarav-designs@sample.workido.test (and other sample-*@sample.workido.test)");
}

async function markPaid(orderId: string) {
  const order = await must(admin.from("orders").select("total_minor, currency").eq("id", orderId).single(), "order");
  const payment = await must(
    admin
      .from("payments")
      .insert({
        order_id: orderId,
        provider: "dev",
        provider_order_id: `dev_seed_${randomUUID()}`,
        amount_minor: order.total_minor!,
        currency: order.currency,
        idempotency_key: `seed-${orderId}`,
      })
      .select("id")
      .single(),
    "payment",
  );
  await must(admin.rpc("apply_payment_success", { p_payment_id: payment.id, p_provider_payment_id: `dev_seed_pay_${randomUUID()}` }), "apply payment");
}

async function completeSampleOrder(
  buyer: { id: string; client: Client },
  specialist: { id: string; client: Client },
  serviceId: string,
  rating: number,
  comment: string,
) {
  const orderId = await must(
    buyer.client.rpc("create_service_order", { p_service_id: serviceId, p_brief: "Sample order created by the development seed." }),
    "create order",
  );
  await markPaid(orderId);
  await must(specialist.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "accept" }), "accept");
  await must(
    specialist.client.from("order_deliverables").insert({
      order_id: orderId,
      uploaded_by: specialist.id,
      kind: "link",
      external_url: "https://example.com/sample-deliverable",
      filename: "Sample deliverable link",
    }),
    "deliverable",
  );
  await must(specialist.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "submit", p_note: "Sample delivery." }), "submit");
  await must(buyer.client.rpc("perform_order_action", { p_order_id: orderId, p_action: "approve" }), "approve");
  await must(buyer.client.from("reviews").insert({ order_id: orderId, reviewer_id: buyer.id, reviewee_id: specialist.id, rating, comment }), "review");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
