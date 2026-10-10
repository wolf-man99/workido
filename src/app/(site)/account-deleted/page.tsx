import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <Container className="max-w-xl py-20 text-center">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Hoping to see you again</h1>
      <p className="mt-3 text-ink-soft">
        Your Workido account has been deleted. Whenever you have a task to get done, or skills to offer, you&apos;re welcome back.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/gigs">Browse gigs</Link>
        </Button>
      </div>
    </Container>
  );
}
