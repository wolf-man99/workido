import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  FileCheck2,
  Handshake,
  History,
  ListChecks,
  MessageSquareText,
  Scale,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { CategoryCard, ServiceCard } from "@/components/marketplace/cards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Container } from "@/components/ui/misc";
import { getSiteConfig } from "@/lib/config/site";
import { listTopLevelCategories, searchServices, type CategoryRow, type ServiceListing } from "@/lib/data/marketplace";

async function loadHomeData(): Promise<{ categories: CategoryRow[]; services: ServiceListing[] }> {
  try {
    const [categories, services] = await Promise.all([listTopLevelCategories(), searchServices({ pageSize: 8 })]);
    return { categories, services: services.items };
  } catch (error) {
    // Let Next.js handle its own control-flow errors (e.g. dynamic rendering).
    unstable_rethrow(error);
    console.error("[home] failed to load marketplace data", error);
    return { categories: [], services: [] };
  }
}

const steps = [
  {
    icon: ClipboardList,
    title: "Describe the task",
    body: "Pick a ready-made gig, or post your requirement with a budget, deadline and the deliverables you expect.",
  },
  {
    icon: Handshake,
    title: "Connect with the right specialist",
    body: "Message specialists about their gigs, or get a short, relevant shortlist for a custom task. Agree scope and price before you pay.",
  },
  {
    icon: FileCheck2,
    title: "Get the work completed",
    body: "Pay securely, chat in one place, review the delivery, request a revision if needed, then approve.",
  },
];

const trustPoints = [
  { icon: Sparkles, title: "Skill & portfolio evidence", body: "Specialists show their skills and real work samples before you hire." },
  { icon: ListChecks, title: "Transparent scope & pricing", body: "Prices, deliverables and included revisions are agreed before payment." },
  { icon: History, title: "Clear delivery expectations", body: "Every order has a delivery time and a deadline you can track." },
  { icon: MessageSquareText, title: "Transaction history", body: "Messages, files and every status change live on the order." },
  { icon: Star, title: "Reviews from completed jobs", body: "Only buyers who completed an order can leave a review." },
  { icon: Scale, title: "Structured dispute handling", body: "If something goes wrong, open a dispute and our team reviews the order history." },
];

export default async function HomePage() {
  const site = getSiteConfig();
  const { categories, services } = await loadHomeData();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-sun/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-[24rem] rounded-full bg-brand/15 blur-3xl" />
        <Container className="relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="flex animate-fade-up flex-col gap-6">
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">{site.hero.headline}</h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-soft">{site.hero.subheadline}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/dashboard/buyer/requirements/new">
                  Post a task <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/gigs">Explore gigs</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
              {["Clear scope before you pay", "No bidding wars", "Revisions included"].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-mint-text" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Product illustration: the three moments of a task (not data). */}
          <div aria-hidden className="relative mx-auto w-full max-w-md">
            <div className="rotate-[-2deg] rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-lift)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your task</p>
              <p className="mt-1 font-display text-lg font-bold">Instagram carousel · 8 slides</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-mist px-2.5 py-1">Budget set</span>
                <span className="rounded-full bg-mist px-2.5 py-1">Due Friday</span>
                <span className="rounded-full bg-mist px-2.5 py-1">1 revision</span>
              </div>
            </div>
            <div className="relative z-10 -mt-3 ml-8 rotate-[1.5deg] rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-lift)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your shortlist</p>
              <div className="mt-3 flex flex-col gap-2.5">
                {["Matches your skills", "Available this week", "Price fits your budget"].map((reason, index) => (
                  <div key={reason} className="flex items-center gap-3">
                    <span className={`size-8 rounded-full ${["bg-brand-soft", "bg-sun-soft", "bg-mint-soft"][index]}`} />
                    <span className="h-2.5 w-24 rounded-full bg-mist" />
                    <span className="ml-auto text-xs font-medium text-mint-text">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative z-20 -mt-3 mr-6 rotate-[-1deg] rounded-3xl bg-ink p-5 text-cream shadow-[var(--shadow-lift)]">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-mint text-ink">
                  <Check className="size-5" />
                </span>
                <div>
                  <p className="font-display font-bold">Delivered & approved</p>
                  <p className="text-xs text-cream/70">Hire the same specialist again in one click</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Categories */}
      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">What do you need done?</h2>
              <p className="mt-2 text-ink-soft">Browse by category or search across every published gig.</p>
            </div>
            <Link href="/categories" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-text hover:underline">
              All categories <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {categories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          ) : (
            <EmptyState title="Categories are on their way" description="Categories will appear here once the marketplace is configured." />
          )}
        </Container>
      </section>

      {/* Gigs */}
      <section className="border-y border-border bg-card/60 py-16 sm:py-20">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Gigs you can buy today</h2>
              <p className="mt-2 text-ink-soft">Fixed scope, transparent prices and clear delivery times.</p>
            </div>
            <Link href="/gigs" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-text hover:underline">
              Explore all gigs <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {services.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((service) => (
                <ServiceCard key={service.service_id} service={service} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No gigs published yet"
              description="Specialists are setting up their services. Post your task and we'll match you with suitable people."
              action={
                <Button asChild>
                  <Link href="/dashboard/buyer/requirements/new">Post a task</Link>
                </Button>
              }
            />
          )}
        </Container>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight">How Workido works</h2>
            <p className="mt-2 text-ink-soft">From “I need this done” to finished work in three steps.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-ink font-display font-bold text-cream">{index + 1}</span>
                  <step.icon className="size-5 text-brand-text" aria-hidden />
                </div>
                <h3 className="font-display text-xl font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Trust */}
      <section className="bg-ink py-16 text-cream sm:py-20">
        <Container className="flex flex-col gap-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight">Built for trust, not guesswork</h2>
            <p className="mt-2 text-cream/70">
              Trust on Workido is earned through real transactions. We only show ratings from completed orders, and a{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-cream">
                <BadgeCheck className="size-4 text-mint" aria-hidden /> Verified
              </span>{" "}
              badge only after our team has reviewed a specialist’s profile and portfolio.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trustPoints.map((point) => (
              <div key={point.title} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-cream/10 bg-cream/[0.04] p-5">
                <point.icon className="size-5 text-brand" aria-hidden />
                <h3 className="font-display text-lg font-bold">{point.title}</h3>
                <p className="text-sm leading-relaxed text-cream/70">{point.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Two sides */}
      <section className="py-16 sm:py-20">
        <Container className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-brand p-8 text-ink">
            <h2 className="font-display text-2xl font-bold">Need something done?</h2>
            <p className="text-ink/80">Buy a ready-made gig or post a custom task. Pay only for agreed scope.</p>
            <div className="mt-auto flex flex-wrap gap-3">
              <Button asChild variant="dark">
                <Link href="/dashboard/buyer/requirements/new">Post a task</Link>
              </Button>
              <Button asChild variant="outline" className="border-ink/20 bg-transparent hover:bg-ink/5">
                <Link href="/gigs">Browse gigs</Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-sun-soft p-8">
            <h2 className="font-display text-2xl font-bold">Got skills? Earn with them.</h2>
            <p className="text-ink-soft">Publish your services, showcase your portfolio and get invited to tasks that fit you.</p>
            <div className="mt-auto">
              <Button asChild variant="dark">
                <Link href="/signup?role=specialist">Become a specialist</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
