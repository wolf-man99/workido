"use client";

import {
  Bell,
  Bookmark,
  Briefcase,
  CalendarClock,
  ClipboardList,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function buildSections(isSpecialist: boolean): NavSection[] {
  const sections: NavSection[] = [
    {
      title: "Hiring",
      items: [
        { href: "/dashboard/buyer", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/dashboard/buyer/requirements", label: "My requirements", icon: ClipboardList },
        { href: "/dashboard/buyer/orders", label: "Orders", icon: ShoppingBag },
        { href: "/dashboard/buyer/saved", label: "Saved specialists", icon: Bookmark },
      ],
    },
  ];
  if (isSpecialist) {
    sections.push({
      title: "Selling",
      items: [
        { href: "/dashboard/specialist", label: "Overview", icon: Briefcase, exact: true },
        { href: "/dashboard/specialist/opportunities", label: "Opportunities", icon: Inbox },
        { href: "/dashboard/specialist/orders", label: "Orders", icon: Package },
        { href: "/dashboard/specialist/services", label: "My services", icon: Store },
        { href: "/dashboard/specialist/portfolio", label: "Portfolio", icon: FolderOpen },
        { href: "/dashboard/specialist/profile", label: "Profile & skills", icon: UserRound },
        { href: "/dashboard/specialist/availability", label: "Availability", icon: CalendarClock },
      ],
    });
  }
  sections.push({
    title: "Account",
    items: [
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  });
  return sections;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardNav({ isSpecialist }: { isSpecialist: boolean }) {
  const pathname = usePathname();
  const sections = buildSections(isSpecialist);

  return (
    <>
      {/* Mobile: horizontally scrollable pills */}
      <nav aria-label="Dashboard" className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
        <ul className="flex w-max gap-2">
          {sections.flatMap((section) =>
            section.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={`${section.title}-${item.href}`}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold",
                      active ? "border-ink bg-ink text-cream" : "border-border bg-card text-ink-soft",
                    )}
                  >
                    {section.title === "Selling" && item.exact ? "Selling" : section.title === "Hiring" && item.exact ? "Hiring" : item.label}
                  </Link>
                </li>
              );
            }),
          )}
        </ul>
      </nav>

      {/* Desktop: sidebar */}
      <nav aria-label="Dashboard" className="sticky top-20 hidden w-60 shrink-0 flex-col gap-6 self-start lg:flex">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{section.title}</p>
            {section.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-ink text-cream" : "text-ink-soft hover:bg-ink/5 hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        {!isSpecialist ? (
          <Link href="/dashboard?enable=specialist" className="rounded-2xl border border-border bg-sun-soft p-4 text-sm">
            <span className="block font-bold text-ink">Have a skill to offer?</span>
            <span className="text-ink-soft">Set up specialist tools and start earning.</span>
          </Link>
        ) : null}
      </nav>
    </>
  );
}
