"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Filters are collapsible on small screens and always visible on desktop. */
export function FilterDisclosure({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="flex w-full items-center justify-between font-semibold lg:hidden"
        aria-expanded={open}
        aria-controls="filter-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden /> Filters {activeCount > 0 ? `(${activeCount})` : ""}
        </span>
        <span className="text-sm text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      <div id="filter-panel" className={cn("mt-4 flex-col gap-4 lg:mt-0 lg:flex", open ? "flex" : "hidden")}>
        {children}
      </div>
    </>
  );
}
