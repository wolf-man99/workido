import { cn } from "@/lib/utils";

/**
 * ".workido." — the two orange dots stand for the hirer and the specialist,
 * with the platform in between. Replace this component (and BrandMark) when
 * the final custom logo is ready; nothing else references logo internals.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline font-display text-2xl font-bold tracking-tight text-ink", className)}>
      <span className="mr-[0.06em] inline-block size-[0.32em] rounded-full bg-brand" aria-hidden />
      workido
      <span className="ml-[0.06em] inline-block size-[0.32em] rounded-full bg-brand" aria-hidden />
    </span>
  );
}

/** Compact ".w." mark for the favicon/app icon (keep in sync with src/app/icon.svg). */
export function BrandMark({ className, title = "Workido" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} role="img" aria-label={title}>
      <rect width="64" height="64" rx="18" fill="#171717" />
      <path d="M20 23l6 19 6-13 6 13 6-19" fill="none" stroke="#FFFDF8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.5" cy="39.5" r="5" fill="#FF6B35" />
      <circle cx="51.5" cy="39.5" r="5" fill="#FF6B35" />
    </svg>
  );
}
