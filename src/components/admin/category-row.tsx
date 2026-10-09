"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CategoryInput } from "@/lib/actions/admin";
import { CategoryForm } from "./admin-forms";

export function CategoryRow({
  id,
  defaults,
  parents,
  iconKeys,
  parentName,
}: {
  id: string;
  defaults: CategoryInput;
  parents: { id: string; name: string }[];
  iconKeys: string[];
  parentName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{defaults.name}</span>
        <span className="font-mono text-xs text-muted-foreground">/{defaults.slug}</span>
        {parentName ? <Badge tone="outline">in {parentName}</Badge> : null}
        {!defaults.isActive ? <Badge tone="warning">Inactive</Badge> : null}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>
          {editing ? "Close" : "Edit"}
        </Button>
      </div>
      {editing ? <CategoryForm categoryId={id} defaults={defaults} parents={parents} iconKeys={iconKeys} onDone={() => setEditing(false)} /> : null}
    </li>
  );
}
