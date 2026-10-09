"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the digest is logged; error details stay on the server.
    console.error("[ui] unexpected error", error.digest ?? "");
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-ink-soft">
          We couldn&apos;t load this page. Please try again — if it keeps happening, contact support{error.digest ? ` and mention reference ${error.digest}` : ""}.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
