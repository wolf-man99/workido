import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Account suspended" };

export default function AccountSuspendedPage() {
  return (
    <Container className="max-w-xl py-20">
      <h1 className="font-display text-3xl font-bold">Your account is suspended</h1>
      <p className="mt-3 text-ink-soft">
        While your account is suspended you can&apos;t post tasks, place orders or send messages. If you think this is a mistake, please get in
        touch with our support team.
      </p>
      <Link href="/contact" className="mt-6 inline-block font-semibold text-brand-text hover:underline">
        Contact support
      </Link>
    </Container>
  );
}
