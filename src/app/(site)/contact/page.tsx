import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteConfig } from "@/lib/config/site";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the Workido team." };

export default async function ContactPage() {
  const [user, site] = [await getCurrentUser(), getSiteConfig()];
  return (
    <Container className="grid gap-10 py-12 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight">Contact us</h1>
        <p className="text-ink-soft">Questions about buying, selling, payments or safety? Send us a message and the team will reply by email.</p>
        {site.supportEmail ? (
          <a href={`mailto:${site.supportEmail}`} className="inline-flex items-center gap-2 font-semibold text-brand-text hover:underline">
            <Mail className="size-4" aria-hidden /> {site.supportEmail}
          </a>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Problem with a specific order? Open it from your{" "}
          <Link href="/dashboard" className="font-semibold text-brand-text hover:underline">
            dashboard
          </Link>{" "}
          — you can message the other party or open a dispute there.
        </p>
      </div>
      <div className="relative rounded-3xl border border-border bg-card p-6 sm:p-8">
        <ContactForm defaultName={user?.fullName ?? ""} defaultEmail={user?.email ?? ""} />
      </div>
    </Container>
  );
}
