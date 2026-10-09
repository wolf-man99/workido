import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Container } from "@/components/ui/misc";
import { getSiteConfig } from "@/lib/config/site";

export function SiteFooter() {
  const site = getSiteConfig();
  const year = new Date().getFullYear();
  const linkClass = "text-sm text-ink-soft hover:text-ink";

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="max-w-xs text-sm text-muted-foreground">{site.tagline ?? "Small professional tasks, done by skilled specialists."}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-bold text-ink">Marketplace</p>
          <Link className={linkClass} href="/gigs">
            Explore gigs
          </Link>
          <Link className={linkClass} href="/specialists">
            Find specialists
          </Link>
          <Link className={linkClass} href="/categories">
            Categories
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-bold text-ink">Company</p>
          <Link className={linkClass} href="/how-it-works#about">
            About
          </Link>
          <Link className={linkClass} href="/how-it-works">
            How it works
          </Link>
          <Link className={linkClass} href="/contact">
            Contact
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-bold text-ink">Legal</p>
          <Link className={linkClass} href="/privacy">
            Privacy
          </Link>
          <Link className={linkClass} href="/terms">
            Terms
          </Link>
          {site.social.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-3">
              {site.social.map((item) => (
                <a key={item.label} className={linkClass} href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
      <Container className="border-t border-border py-6">
        <p className="text-xs text-muted-foreground">© {year} Workido. All rights reserved.</p>
      </Container>
    </footer>
  );
}
