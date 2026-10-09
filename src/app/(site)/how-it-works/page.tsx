import { BadgeCheck, ClipboardList, CreditCard, FileCheck2, MessageSquare, Repeat, Scale, ShoppingBag, Sparkles, Store, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Workido helps you get small professional tasks done, and how specialists earn with their skills.",
};

const buyerSteps = [
  { icon: ShoppingBag, title: "Buy a ready-made gig", body: "Know what you need? Pick a gig with a fixed price, clear deliverables and a delivery time. Add your requirements and pay." },
  { icon: ClipboardList, title: "Or post a custom task", body: "Describe the work, set a budget and deadline. We build a short, relevant shortlist and explain why each person fits." },
  { icon: Sparkles, title: "Invite and compare", body: "Invite the specialists you like. They send one offer each — price, timeline and revisions — so you compare like for like. No bidding wars." },
  { icon: CreditCard, title: "Pay securely", body: "Accept an offer and pay through our payment provider. Work starts when the specialist accepts the paid order." },
  { icon: FileCheck2, title: "Review and approve", body: "Get deliverables in one place. Request a revision within the agreed policy, or approve to complete the order." },
  { icon: Repeat, title: "Hire again", body: "Found someone great? Rehire them for your next task in a couple of clicks." },
];

const specialistSteps = [
  { icon: UserRoundCheck, title: "Build your profile", body: "Add your skills, experience and portfolio. Publish when it's ready." },
  { icon: Store, title: "Publish services", body: "Package what you do best with a clear scope, honest delivery time and fixed price." },
  { icon: Sparkles, title: "Get invited", body: "Matching considers skills, category, availability, delivery time, budget and portfolio evidence. Keep your availability accurate." },
  { icon: MessageSquare, title: "Deliver great work", body: "Accept paid orders, chat with the buyer, upload deliverables and handle revisions." },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="border-b border-border">
        <Container className="flex flex-col gap-4 py-16 sm:py-20">
          <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">From “I need this done” to finished work.</h1>
          <p className="max-w-2xl text-lg text-ink-soft">
            Workido is a marketplace for small professional tasks. It&apos;s built to help buyers get work completed — not to make them scroll through
            hundreds of profiles.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard/buyer/requirements/new">Post a task</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup?role=specialist">Become a specialist</Link>
            </Button>
          </div>
        </Container>
      </section>

      <section className="py-16">
        <Container className="flex flex-col gap-8">
          <h2 className="font-display text-3xl font-bold">For buyers</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buyerSteps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-cream">{index + 1}</span>
                  <step.icon className="size-5 text-brand-text" aria-hidden />
                </div>
                <h3 className="font-display text-lg font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="border-y border-border bg-sun-soft/50 py-16">
        <Container className="flex flex-col gap-8">
          <h2 className="font-display text-3xl font-bold">For specialists</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {specialistSteps.map((step) => (
              <li key={step.title} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-6">
                <step.icon className="size-5 text-brand-text" aria-hidden />
                <h3 className="font-display text-lg font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="py-16">
        <Container className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-6">
            <BadgeCheck className="size-5 text-mint-text" aria-hidden />
            <h3 className="font-display text-lg font-bold">Verification</h3>
            <p className="text-sm text-ink-soft">
              The Verified badge appears only after our team reviews a specialist&apos;s profile and portfolio. Unverified specialists can still work
              on Workido; their track record builds from completed orders.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-6">
            <Scale className="size-5 text-brand-text" aria-hidden />
            <h3 className="font-display text-lg font-bold">Disputes</h3>
            <p className="text-sm text-ink-soft">
              If something goes wrong, either side can open a dispute on an active order. Our team reviews the agreed scope, messages and deliverables
              and decides whether to complete the order, resume work or refund the buyer.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-6">
            <CreditCard className="size-5 text-ink" aria-hidden />
            <h3 className="font-display text-lg font-bold">Payments</h3>
            <p className="text-sm text-ink-soft">
              Payments are processed by our payment provider and verified on our servers. Refunds go back through the same provider. We never see or
              store card details.
            </p>
          </div>
        </Container>
      </section>

      <section id="about" className="scroll-mt-20 border-t border-border bg-card py-16">
        <Container className="flex max-w-3xl flex-col gap-4">
          <h2 className="font-display text-3xl font-bold">About Workido</h2>
          <p className="text-ink-soft">
            Lots of valuable work is small: a carousel for a launch, a tracking fix, a landing page that needs sharper copy. Agencies are overkill
            and hiring full-time doesn&apos;t make sense. Workido exists to make those tasks easy to get done well.
          </p>
          <p className="text-ink-soft">
            We start with marketing, design and content work, and we&apos;re building the platform so more professional categories can follow. Our
            principles are simple: completion over discovery, quality over quantity, transparent prices instead of race-to-the-bottom bidding,
            and trust that&apos;s earned from real, completed work.
          </p>
          <Link href="/contact" className="font-semibold text-brand-text hover:underline">
            Get in touch
          </Link>
        </Container>
      </section>
    </>
  );
}
