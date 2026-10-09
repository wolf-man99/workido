import { cn } from "@/lib/utils";

/**
 * Interim typographic wordmark. Replace this component (and BrandMark) when
 * the final custom logo is ready; nothing else references logo internals.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline font-display text-2xl font-bold tracking-tight text-ink", className)}>
      workido
      <span className="ml-0.5 inline-block size-[0.32em] rounded-full bg-brand" aria-hidden />
    </span>
  );
}

/** Simple geometric mark used for the favicon/app icon and compact spaces. */
export function BrandMark({ className, title = "Workido" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} role="img" aria-label={title}>
      <rect width="64" height="64" rx="18" fill="#171717" />
      <path d="M14 22l7 22 7-15 7 15 7-22" fill="none" stroke="#FFFDF8" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="22" r="5" fill="#FF6B35" />
    </svg>
  );
}
