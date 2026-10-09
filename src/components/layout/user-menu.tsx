"use client";

import { Briefcase, LayoutDashboard, LogOut, MessageSquare, Settings, Shield, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { signOutAction } from "@/lib/actions/auth";

export interface HeaderUser {
  fullName: string;
  username: string;
  avatarPath: string | null;
  isBuyer: boolean;
  isSpecialist: boolean;
  isAdmin: boolean;
}

export function UserMenu({ user }: { user: HeaderUser }) {
  const [signingOut, startSignOut] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" aria-label="Open account menu">
        <Avatar name={user.fullName} path={user.avatarPath} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block text-sm font-semibold text-ink">{user.fullName}</span>
          <span className="block text-xs font-normal text-muted-foreground">@{user.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard /> Dashboard
          </Link>
        </DropdownMenuItem>
        {user.isBuyer ? (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/buyer">
              <ShoppingBag /> Hiring
            </Link>
          </DropdownMenuItem>
        ) : null}
        {user.isSpecialist ? (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/specialist">
              <Briefcase /> Selling
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/messages">
            <MessageSquare /> Messages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings /> Account settings
          </Link>
        </DropdownMenuItem>
        {user.isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {/* Called directly: the menu unmounts on select, so a <form> inside it would never submit. */}
        <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOutAction())}>
          <LogOut /> {signingOut ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
