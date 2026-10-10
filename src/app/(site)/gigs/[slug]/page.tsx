import { CalendarClock, Check, Clock, ExternalLink, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderNowPanel, SaveSpecialistButton, UnavailableNotice } from "@/components/forms/order-forms";
import { ContactSpecialistButton } from "@/components/messages/contact-specialist-button";
import { ReviewList } from "@/components/marketplace/reviews";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AvailabilityDot, Container, RatingSummary, SampleBadge, VerifiedBadge } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getServiceBySlug } from "@/lib/data/services";
import { isSpecialistSaved } from "@/lib/data/specialist";
import { formatMoney } from "@/lib/domain/money";
import { formatDeliveryTime } from "@/lib/format";
import { publicStorageUrl } from "@/lib/storage/public-url";

export async function generateMetadata(props: PageProps<"/gigs/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getServiceBySlug(slug);
  if (!data) return { title: "Gig not found" };
  return { title: data.service.title, description: data.service.description.slice(0, 155) };
}

export default async function GigDetailPage(props: PageProps<"/gigs/[slug]">) {
  const { slug } = await props.params;
  const [data, user] = await Promise.all([getServiceBySlug(slug), getCurrentUser()]);
  if (!data) notFound();
  const { service, specialistProfile, specialist, portfolio, reviews } = data;
  const firstName = specialistProfile.full_name.split(/\s+/)[0] || "the specialist";
  const isOwner = user?.id === service.specialist_id;
  const isPublished = service.publication_status === "published" && specialist.is_published;
  const showMobileBar = !isOwner && isPublished;
  const saved = user && !isOwner ? await isSpecialistSaved(user.id, service.specialist_id) : false;

  return (
    <Container className="py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/gigs" className="hover:underline">
          Gigs
        </Link>
        {service.categories ? (
          <>
            {" / "}
            <Link href={`/categories/${service.categories.slug}`} className="hover:underline">
              {service.categories.name}
            </Link>
          </>
        ) : null}
      </nav>

      {isOwner && !isPublished ? (
        <p className="mb-4 rounded-2xl bg-sun-soft p-3 text-sm text-warning-text">Preview: this listing isn&apos;t publicly visible yet.</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <article className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-4">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{service.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/specialists/${specialistProfile.username}`} className="flex items-center gap-2.5 rounded-full pr-2 hover:bg-ink/5">
                <Avatar name={specialistProfile.full_name} path={specialistProfile.avatar_path} size="md" />
                <span className="flex flex-col">
                  <span className="font-semibold">{specialistProfile.full_name}</span>
                  <span className="text-xs text-muted-foreground">{specialist.headline}</span>
                </span>
              </Link>
              <AvailabilityDot status={specialist.availability_status} />
              <VerifiedBadge status={specialist.verification_status} />
              <SampleBadge isSample={specialistProfile.is_sample} />
              <RatingSummary ratingAvg={specialist.rating_avg} ratingCount={specialist.rating_count} />
            </div>
          </header>

          {portfolio.length > 0 ? (
            <section aria-label="Portfolio examples" className="grid grid-cols-2 gap-3">
              {portfolio.map((item) =>
                item.asset_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={item.id} src={publicStorageUrl("portfolio", item.asset_path)} alt={item.title} className="aspect-[16/10] w-full rounded-2xl border border-border object-cover" loading="lazy" />
                ) : item.external_url ? (
                  <a key={item.id} href={item.external_url} target="_blank" rel="noopener noreferrer nofollow" className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-mist p-4 text-center text-sm font-semibold hover:bg-mist/70">
                    <ExternalLink className="size-5" aria-hidden /> {item.title}
                  </a>
                ) : null,
              )}
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">About this gig</h2>
            <p className="whitespace-pre-line leading-relaxed text-ink-soft">{service.description}</p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">What you get</h2>
            <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <Check className="mt-0.5 size-5 shrink-0 text-mint-text" aria-hidden />
              <p className="whitespace-pre-line text-ink-soft">{service.deliverables}</p>
            </div>
          </section>

          {service.buyer_instructions ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold">What the specialist needs from you</h2>
              <p className="whitespace-pre-line text-ink-soft">{service.buyer_instructions}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">Reviews</h2>
            <ReviewList reviews={reviews} />
          </section>
        </article>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fixed price</p>
              <p className="font-display text-4xl font-bold">{formatMoney(service.price_minor, service.currency)}</p>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-ink/60" aria-hidden /> Delivered within {formatDeliveryTime(service.delivery_time_hours)} of acceptance
              </li>
              <li className="flex items-center gap-2">
                <Repeat className="size-4 text-ink/60" aria-hidden /> {service.included_revisions} revision round{service.included_revisions === 1 ? "" : "s"} included
              </li>
              <li className="flex items-center gap-2">
                <CalendarClock className="size-4 text-ink/60" aria-hidden /> Work starts after the specialist accepts
              </li>
            </ul>
            <div className="h-px bg-border" />
            {isOwner ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/specialist/services/${service.id}/edit`}>Edit your service</Link>
              </Button>
            ) : !isPublished ? (
              <p className="text-sm text-muted-foreground">This gig isn&apos;t available right now.</p>
            ) : user ? (
              <div className="flex flex-col gap-3">
                {specialist.availability_status === "unavailable" ? <UnavailableNotice /> : null}
                <ContactSpecialistButton specialistId={service.specialist_id} serviceId={service.id} label={`Contact ${firstName}`} size="lg" />
                <p className="text-xs text-muted-foreground">Ask questions and agree the details first. You only pay when you place the order.</p>
                {specialist.availability_status !== "unavailable" ? (
                  <OrderNowPanel serviceId={service.id} instructions={service.buyer_instructions} label="Ready to go? Order now" />
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button asChild size="lg">
                  <Link href={`/login?next=${encodeURIComponent(`/gigs/${service.slug}`)}`}>Log in to contact {firstName}</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/signup">New here? Create an account</Link>
                </Button>
              </div>
            )}
            {user && !isOwner ? (
              <div className="flex flex-wrap gap-2">
                <SaveSpecialistButton specialistId={service.specialist_id} initiallySaved={saved} />
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/dashboard/buyer/requirements/new?invite=${specialistProfile.username}`}>Request a custom task</Link>
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Price shown before payment includes any applicable fees. You pay only after reviewing the final total.</p>
          </div>
        </aside>
      </div>

      {/* On small screens the order panel sits below the reviews; keep the main action in reach. */}
      {showMobileBar ? (
        <div className="sticky bottom-0 z-30 -mx-4 -mb-8 mt-8 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-10 sm:px-6 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fixed price</p>
              <p className="font-display text-lg font-bold leading-tight">{formatMoney(service.price_minor, service.currency)}</p>
            </div>
            {user ? (
              <ContactSpecialistButton specialistId={service.specialist_id} serviceId={service.id} label={`Contact ${firstName}`} className="flex-1" />
            ) : (
              <Button asChild className="flex-1">
                <Link href={`/login?next=${encodeURIComponent(`/gigs/${service.slug}`)}`}>Log in to contact {firstName}</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Container>
  );
}
