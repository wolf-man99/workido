import { CalendarDays, ExternalLink, Globe, MapPin, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveSpecialistButton } from "@/components/forms/order-forms";
import { ContactSpecialistButton } from "@/components/messages/contact-specialist-button";
import { ServiceCard } from "@/components/marketplace/cards";
import { ReviewList } from "@/components/marketplace/reviews";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AvailabilityDot, Container, SampleBadge, VerifiedBadge } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { searchServices } from "@/lib/data/marketplace";
import { getPublicSpecialistProfile, isSpecialistSaved } from "@/lib/data/specialist";
import { displayCancellation, displayOnTime, displayRating, type MetricDisplay } from "@/lib/domain/reputation";
import { EXPERIENCE_LABELS, formatDate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(props: PageProps<"/specialists/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  const data = await getPublicSpecialistProfile(username);
  if (!data) return { title: "Specialist not found" };
  return { title: data.profile.full_name, description: data.specialist.headline ?? undefined };
}

function Metric({ label, display }: { label: string; display: MetricDisplay | { kind: "value"; value: string } }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={display.kind === "value" ? "font-display text-xl font-bold" : "text-sm text-muted-foreground"}>
        {display.kind === "value" ? display.value : "Not enough data yet"}
      </dd>
    </div>
  );
}

export default async function SpecialistProfilePage(props: PageProps<"/specialists/[username]">) {
  const { username } = await props.params;
  const [data, user] = await Promise.all([getPublicSpecialistProfile(username), getCurrentUser()]);
  if (!data) notFound();
  const { profile, specialist, skills, categories, portfolio, reviews, reputation } = data;
  const isSelf = user?.id === profile.id;

  const [{ items: services }, saved, previousOrders] = await Promise.all([
    searchServices({ specialistId: profile.id, pageSize: 12 }),
    user && !isSelf ? isSpecialistSaved(user.id, profile.id) : Promise.resolve(false),
    user && !isSelf
      ? (await createSupabaseServerClient())
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", user.id)
          .eq("specialist_id", profile.id)
          .eq("status", "completed")
      : Promise.resolve({ count: 0 }),
  ]);
  const hasWorkedTogether = (previousOrders.count ?? 0) > 0;
  const location = [profile.city, profile.region].filter(Boolean).join(", ");

  return (
    <Container className="flex flex-col gap-10 py-8 sm:py-10">
      {isSelf && !specialist.is_published ? (
        <p className="rounded-2xl bg-sun-soft p-3 text-sm text-warning-text">Preview: your profile isn&apos;t published yet, so only you can see it.</p>
      ) : null}

      <header className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-start sm:p-8">
        <Avatar name={profile.full_name} path={profile.avatar_path} size="xl" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">{profile.full_name}</h1>
            <VerifiedBadge status={specialist.verification_status} />
            <SampleBadge isSample={profile.is_sample} />
          </div>
          {specialist.headline ? <p className="text-lg text-ink-soft">{specialist.headline}</p> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <AvailabilityDot status={specialist.availability_status} />
            {specialist.experience_level ? <span>{EXPERIENCE_LABELS[specialist.experience_level]}</span> : null}
            {location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden /> {location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" aria-hidden /> Joined {formatDate(profile.created_at)}
            </span>
            {profile.website_url ? (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-semibold text-brand-text hover:underline">
                <Globe className="size-4" aria-hidden /> Website
              </a>
            ) : null}
          </div>
          {!isSelf ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {hasWorkedTogether ? (
                <Button asChild>
                  <Link href={`/dashboard/buyer/requirements/new?invite=${profile.username}`}>
                    <Repeat aria-hidden /> Hire again
                  </Link>
                </Button>
              ) : specialist.availability_status !== "unavailable" ? (
                <Button asChild>
                  <Link href={`/dashboard/buyer/requirements/new?invite=${profile.username}`}>Invite to a task</Link>
                </Button>
              ) : null}
              {user ? (
                <ContactSpecialistButton specialistId={profile.id} label="Message" variant={hasWorkedTogether || specialist.availability_status !== "unavailable" ? "outline" : "primary"} />
              ) : (
                <Button asChild variant="outline">
                  <Link href={`/login?next=${encodeURIComponent(`/specialists/${profile.username}`)}`}>Log in to message</Link>
                </Button>
              )}
              {user ? <SaveSpecialistButton specialistId={profile.id} initiallySaved={saved} /> : null}
            </div>
          ) : (
            <Button asChild variant="outline" className="self-start">
              <Link href="/dashboard/specialist/profile">Edit profile</Link>
            </Button>
          )}
        </div>
      </header>

      <section aria-label="Track record">
        <h2 className="mb-3 font-display text-xl font-bold">Track record</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Completed orders" display={{ kind: "value", value: String(reputation?.completedOrders ?? 0) }} />
          <Metric label="Rating" display={reputation ? displayRating(reputation) : { kind: "insufficient" }} />
          <Metric label="On-time delivery" display={reputation ? displayOnTime(reputation) : { kind: "insufficient" }} />
          <Metric label="Repeat clients" display={reputation && reputation.completedOrders > 0 ? { kind: "value", value: String(reputation.repeatClients) } : { kind: "insufficient" }} />
        </dl>
        {reputation && displayCancellation(reputation).kind === "value" ? (
          <p className="mt-2 text-xs text-muted-foreground">Cancellation rate: {(displayCancellation(reputation) as { value: string }).value}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">All metrics are calculated from completed Workido orders.</p>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-10">
          {specialist.professional_bio ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold">About</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink-soft">{specialist.professional_bio}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-bold">Services</h2>
            {services.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {services.map((service) => (
                  <ServiceCard key={service.service_id} service={service} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No published services yet. You can still invite them to a custom task.</p>
            )}
          </section>

          {portfolio.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-bold">Portfolio</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {portfolio.map((item) => (
                  <li key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    {item.asset_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={publicStorageUrl("portfolio", item.asset_path)} alt={item.title} className="aspect-[16/10] w-full object-cover" loading="lazy" />
                    ) : null}
                    <div className="flex flex-col gap-1 p-4">
                      <p className="font-semibold">{item.title}</p>
                      {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                      {item.external_url ? (
                        <a href={item.external_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-text hover:underline">
                          View project <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-bold">Reviews</h2>
            <ReviewList reviews={reviews} />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          {skills.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-lg font-bold">Skills</h2>
              <ul className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <li key={skill.slug}>
                    <Link href={`/specialists?skill=${skill.slug}`} className="inline-flex rounded-full bg-mist px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-ink hover:text-cream">
                      {skill.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {categories.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-lg font-bold">Works in</h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link href={`/categories/${category.slug}`} className="font-medium hover:underline">
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </Container>
  );
}
