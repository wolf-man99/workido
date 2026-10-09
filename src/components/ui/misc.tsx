import { BadgeCheck, ChevronLeft, ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex flex-col gap-1.5">
        {eyebrow ? <div className="text-sm font-semibold text-brand-text">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Shows a real rating, or an honest "New" label when there are no reviews. */
export function RatingSummary({
  ratingAvg,
  ratingCount,
  className,
}: {
  ratingAvg: number | null;
  ratingCount: number;
  className?: string;
}) {
  if (ratingAvg === null || ratingCount === 0) {
    return <span className={cn("text-xs font-medium text-muted-foreground", className)}>No reviews yet</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold text-ink", className)}>
      <Star className="size-4 fill-sun text-sun" aria-hidden />
      {Number(ratingAvg).toFixed(1)}
      <span className="font-normal text-muted-foreground">({ratingCount})</span>
      <span className="sr-only">
        Rated {Number(ratingAvg).toFixed(1)} out of 5 from {ratingCount} review{ratingCount === 1 ? "" : "s"}
      </span>
    </span>
  );
}

export function StarRow({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} aria-hidden className={cn("size-4", value <= rating ? "fill-sun text-sun" : "text-ink/20")} />
      ))}
    </span>
  );
}

/** Only rendered for admin-approved verification. */
export function VerifiedBadge({ status }: { status: string }) {
  if (status !== "verified") return null;
  return (
    <Badge tone="success" title="Profile and portfolio reviewed by the Workido team">
      <BadgeCheck aria-hidden /> Verified
    </Badge>
  );
}

export function SampleBadge({ isSample }: { isSample: boolean }) {
  if (!isSample) return null;
  return (
    <Badge tone="outline" title="Fictional development data, not a real person">
      Sample profile
    </Badge>
  );
}

export function AvailabilityDot({ status }: { status: "available" | "busy" | "unavailable" }) {
  const styles = {
    available: { dot: "bg-mint", label: "Available" },
    busy: { dot: "bg-sun", label: "Busy" },
    unavailable: { dot: "bg-ink/30", label: "Unavailable" },
  }[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft">
      <span className={cn("size-2 rounded-full", styles.dot)} aria-hidden />
      {styles.label}
    </span>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const linkClass =
    "inline-flex h-10 items-center gap-1 rounded-full border border-ink/15 bg-card px-4 text-sm font-semibold hover:bg-mist";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link className={linkClass} href={hrefForPage(page - 1)} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link className={linkClass} href={hrefForPage(page + 1)} rel="next">
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
