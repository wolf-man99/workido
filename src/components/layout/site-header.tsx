import { Bell } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";
import { UserMenu, type HeaderUser } from "./user-menu";

const navLinkClass = "rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink hover:bg-ink/5";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await getUnreadNotificationCount() : 0;
  const headerUser: HeaderUser | null = user
    ? {
        fullName: user.fullName,
        username: user.username,
        avatarPath: user.avatarPath,
        isBuyer: user.isBuyer,
        isSpecialist: user.isSpecialist,
        isAdmin: user.isAdmin,
      }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-cream">
        Skip to content
      </a>
      <Container className="flex h-16 items-center gap-2">
        <Link href="/" className="mr-2 rounded-lg" aria-label="Workido home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          <NavLink href="/gigs" className={navLinkClass}>
            Explore gigs
          </NavLink>
          <NavLink href="/specialists" className={navLinkClass}>
            Find specialists
          </NavLink>
          <NavLink href="/how-it-works" className={navLinkClass}>
            How it works
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {headerUser ? (
            <>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard/buyer/requirements/new">Post a task</Link>
              </Button>
              <Link
                href="/dashboard/notifications"
                className="relative inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-ink/5"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              >
                <Bell className="size-5" aria-hidden />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-ink">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
              <UserMenu user={headerUser} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
          <MobileNav user={headerUser} />
        </div>
      </Container>
    </header>
  );
}
