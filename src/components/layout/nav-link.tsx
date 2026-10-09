"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  className,
  activeClassName = "text-ink bg-ink/5",
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
