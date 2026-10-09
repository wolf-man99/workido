"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/overlays";
import { signOutAction } from "@/lib/actions/auth";
import type { HeaderUser } from "./user-menu";

const linkClass = "flex min-h-12 items-center rounded-xl px-3 text-base font-semibold text-ink hover:bg-ink/5";

export function MobileNav({ user }: { user: HeaderUser | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the menu after navigating (adjusting state during render, not in an effect).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </DialogTrigger>
      <SheetContent title="Menu">
        <nav className="flex flex-col gap-1" aria-label="Mobile">
          <Link className={linkClass} href="/gigs">
            Explore gigs
          </Link>
          <Link className={linkClass} href="/specialists">
            Find specialists
          </Link>
          <Link className={linkClass} href="/categories">
            Categories
          </Link>
          <Link className={linkClass} href="/how-it-works">
            How it works
          </Link>
          <div className="my-3 h-px bg-border" />
          {user ? (
            <>
              <Link className={linkClass} href="/dashboard">
                Dashboard
              </Link>
              {user.isSpecialist ? (
                <Link className={linkClass} href="/dashboard/specialist">
                  Selling
                </Link>
              ) : null}
              <Link className={linkClass} href="/dashboard/messages">
                Messages
              </Link>
              <Link className={linkClass} href="/dashboard/notifications">
                Notifications
              </Link>
              <Link className={linkClass} href="/dashboard/settings">
                Account settings
              </Link>
              {user.isAdmin ? (
                <Link className={linkClass} href="/admin">
                  Admin
                </Link>
              ) : null}
              <Button asChild size="lg" className="mt-4">
                <Link href="/dashboard/buyer/requirements/new">Post a task</Link>
              </Button>
              <form action={signOutAction} className="mt-2">
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Log out
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Button asChild size="lg">
                <Link href="/signup">Sign up</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          )}
        </nav>
      </SheetContent>
    </Dialog>
  );
}
