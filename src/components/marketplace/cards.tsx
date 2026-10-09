import { ArrowRight, Clock, Repeat } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { AvailabilityDot, RatingSummary, SampleBadge, VerifiedBadge } from "@/components/ui/misc";
import { formatMoney } from "@/lib/domain/money";
import { EXPERIENCE_LABELS, formatDeliveryTime } from "@/lib/format";
import { publicStorageUrl } from "@/lib/storage/public-url";
import type { CategoryRow, ServiceListing, SpecialistListing } from "@/lib/data/marketplace";
import { CategoryIcon } from "./category-icon";

export function CategoryCard({ category }: { category: Pick<CategoryRow, "name" | "slug" | "description" | "icon"> }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[var(--shadow-lift)]"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-text transition-colors group-hover:bg-brand group-hover:text-ink">
        <CategoryIcon icon={category.icon} className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="font-display text-base font-bold text-ink">{category.name}</span>
        {category.description ? <span className="line-clamp-2 text-sm text-muted-foreground">{category.description}</span> : null}
      </div>
    </Link>
  );
}

export function ServiceCard({ service }: { service: ServiceListing }) {
  const cover = service.cover_path ? publicStorageUrl("portfolio", service.cover_path) : null;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-brand-soft via-sun-soft to-cream">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-semibold text-ink-soft">{service.category_name}</span>
          </div>
        )}
        {service.specialist_is_sample ? (
          <div className="absolute left-3 top-3">
            <SampleBadge isSample />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Avatar name={service.specialist_name} path={service.specialist_avatar_path} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{service.specialist_name}</p>
            <AvailabilityDot status={service.availability_status} />
          </div>
          <VerifiedBadge status={service.verification_status} />
        </div>
        <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-ink">
          <Link href={`/gigs/${service.slug}`} className="after:absolute after:inset-0">
            {service.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatDeliveryTime(service.delivery_time_hours)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat className="size-3.5" aria-hidden /> {service.included_revisions} revision{service.included_revisions === 1 ? "" : "s"}
          </span>
          <span>{service.category_name}</span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-3">
          <RatingSummary ratingAvg={service.rating_avg} ratingCount={service.rating_count} />
          <p className="text-right">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">From</span>
            <span className="font-display text-lg font-bold text-ink">{formatMoney(service.price_minor, service.currency)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

export function SpecialistCard({ specialist }: { specialist: SpecialistListing }) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start gap-3">
        <Avatar name={specialist.full_name} path={specialist.avatar_path} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold text-ink">
            <Link href={`/specialists/${specialist.username}`} className="after:absolute after:inset-0">
              {specialist.full_name}
            </Link>
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{specialist.headline}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AvailabilityDot status={specialist.availability_status} />
        <VerifiedBadge status={specialist.verification_status} />
        <SampleBadge isSample={specialist.is_sample} />
        {specialist.experience_level ? <span className="text-xs text-muted-foreground">· {EXPERIENCE_LABELS[specialist.experience_level]}</span> : null}
      </div>
      {specialist.skills.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
          {specialist.skills.slice(0, 4).map((skill) => (
            <li key={skill} className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink-soft">
              {skill}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <RatingSummary ratingAvg={specialist.rating_avg} ratingCount={specialist.rating_count} />
        {specialist.starting_price_minor !== null ? (
          <span className="text-sm text-muted-foreground">
            From <span className="font-bold text-ink">{formatMoney(specialist.starting_price_minor, specialist.currency ?? "INR")}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-text">
            View profile <ArrowRight className="size-4" aria-hidden />
          </span>
        )}
      </div>
    </article>
  );
}
