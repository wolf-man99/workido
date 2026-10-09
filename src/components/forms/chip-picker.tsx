"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface ChipOption {
  id: string;
  label: string;
  group?: string;
}

/** Accessible multi-select rendered as toggle chips, with optional search and grouping. */
export function ChipPicker({
  options,
  value,
  onChange,
  max,
  searchable = false,
  label,
  id,
}: {
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  searchable?: boolean;
  label: string;
  id: string;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => option.label.toLowerCase().includes(q) || option.group?.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const groups = useMemo(() => {
    const map = new Map<string, ChipOption[]>();
    for (const option of filtered) {
      const key = option.group ?? "";
      map.set(key, [...(map.get(key) ?? []), option]);
    }
    return [...map.entries()];
  }, [filtered]);

  const toggle = (optionId: string) => {
    if (selected.has(optionId)) onChange(value.filter((v) => v !== optionId));
    else if (!max || value.length < max) onChange([...value, optionId]);
  };

  return (
    <div className="flex flex-col gap-3" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      {searchable ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            aria-label={`Search ${label.toLowerCase()}`}
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm focus-visible:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
          />
        </div>
      ) : null}
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
        {groups.map(([group, items]) => (
          <div key={group || "all"} className="flex flex-col gap-2">
            {group ? <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p> : null}
            <div className="flex flex-wrap gap-2">
              {items.map((option) => {
                const isOn = selected.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggle(option.id)}
                    disabled={!isOn && Boolean(max) && value.length >= (max ?? 0)}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-40",
                      isOn ? "border-ink bg-ink text-cream" : "border-border bg-card text-ink-soft hover:border-ink/30",
                    )}
                  >
                    {isOn ? <Check className="size-3.5" aria-hidden /> : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No matches.</p> : null}
      </div>
      {max ? (
        <p className="text-xs text-muted-foreground">
          {value.length} of {max} selected
        </p>
      ) : null}
    </div>
  );
}
