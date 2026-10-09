import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Link href="/" aria-label="Workido home">
        <Wordmark />
      </Link>
      <div className="flex flex-col gap-2">
        <p className="font-display text-6xl font-bold text-brand">404</p>
        <h1 className="font-display text-2xl font-bold">We couldn&apos;t find that page</h1>
        <p className="max-w-md text-ink-soft">It may have moved, or you may not have access to it.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/gigs">Explore gigs</Link>
        </Button>
      </div>
    </main>
  );
}
