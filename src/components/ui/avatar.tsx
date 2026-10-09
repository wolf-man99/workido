import { cn, initials } from "@/lib/utils";
import { publicStorageUrl } from "@/lib/storage/public-url";

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base", xl: "size-20 text-xl" } as const;

const palette = ["bg-brand-soft text-brand-text", "bg-sun-soft text-warning-text", "bg-mint-soft text-mint-text", "bg-mist text-ink"];

function colourFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function Avatar({
  name,
  path,
  size = "md",
  className,
}: {
  name: string;
  path?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const url = path ? publicStorageUrl("avatars", path) : null;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold", sizes[size], !url && colourFor(name), className)}>
      {url ? (
        // User-uploaded images are served from Supabase Storage; plain <img>
        // avoids routing them through the Next.js image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
