import Link from "next/link";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { CategoryRow, SkillRow } from "@/lib/data/marketplace";
import { FilterDisclosure } from "./filter-disclosure";
import { DELIVERY_OPTIONS, GIG_SORTS, SPECIALIST_SORTS } from "@/lib/validation/filters";

function FilterShell({ action, children, resetHref, activeCount }: { action: string; children: React.ReactNode; resetHref: string; activeCount: number }) {
  return (
    <form method="get" action={action} className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <FilterDisclosure activeCount={activeCount}>
        {children}
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="flex-1">
            Apply filters
          </Button>
          {activeCount > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={resetHref}>Reset</Link>
            </Button>
          ) : null}
        </div>
      </FilterDisclosure>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function GigFilters({
  action,
  values,
  categories,
  skills,
  hideCategory = false,
}: {
  action: string;
  values: Record<string, string | undefined>;
  categories: CategoryRow[];
  skills: SkillRow[];
  hideCategory?: boolean;
}) {
  const activeCount = ["q", "category", "skill", "min", "max", "delivery", "rating", "availability"].filter(
    (key) => values[key] && !(hideCategory && key === "category"),
  ).length;
  return (
    <FilterShell action={action} resetHref={action} activeCount={activeCount}>
      <Field id="q" label="Search">
        <Input id="q" name="q" type="search" defaultValue={values.q} placeholder="e.g. carousel, GA4" />
      </Field>
      {!hideCategory ? (
        <Field id="category" label="Category">
          <Select id="category" name="category" defaultValue={values.category ?? ""}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.parent_id ? `— ${category.name}` : category.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field id="skill" label="Skill">
        <Select id="skill" name="skill" defaultValue={values.skill ?? ""}>
          <option value="">Any skill</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.slug}>
              {skill.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field id="min" label="Min ₹">
          <Input id="min" name="min" inputMode="numeric" defaultValue={values.min} placeholder="0" />
        </Field>
        <Field id="max" label="Max ₹">
          <Input id="max" name="max" inputMode="numeric" defaultValue={values.max} placeholder="Any" />
        </Field>
      </div>
      <Field id="delivery" label="Delivery time">
        <Select id="delivery" name="delivery" defaultValue={values.delivery ?? ""}>
          <option value="">Any time</option>
          {DELIVERY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="rating" label="Rating">
        <Select id="rating" name="rating" defaultValue={values.rating ?? ""}>
          <option value="">Any (including new)</option>
          <option value="4">4.0 and above</option>
          <option value="4.5">4.5 and above</option>
        </Select>
      </Field>
      <Field id="availability" label="Availability">
        <Select id="availability" name="availability" defaultValue={values.availability ?? ""}>
          <option value="">Any</option>
          <option value="available">Available now</option>
          <option value="busy">Busy</option>
        </Select>
      </Field>
      <Field id="sort" label="Sort by">
        <Select id="sort" name="sort" defaultValue={values.sort ?? "recommended"}>
          {GIG_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    </FilterShell>
  );
}

export function SpecialistFilters({
  values,
  categories,
  skills,
}: {
  values: Record<string, string | undefined>;
  categories: CategoryRow[];
  skills: SkillRow[];
}) {
  const activeCount = ["q", "category", "skill", "max", "experience", "rating", "availability"].filter((key) => values[key]).length;
  return (
    <FilterShell action="/specialists" resetHref="/specialists" activeCount={activeCount}>
      <Field id="q" label="Search">
        <Input id="q" name="q" type="search" defaultValue={values.q} placeholder="Name or headline" />
      </Field>
      <Field id="category" label="Category">
        <Select id="category" name="category" defaultValue={values.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.parent_id ? `— ${category.name}` : category.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="skill" label="Skill">
        <Select id="skill" name="skill" defaultValue={values.skill ?? ""}>
          <option value="">Any skill</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.slug}>
              {skill.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="availability" label="Availability">
        <Select id="availability" name="availability" defaultValue={values.availability ?? ""}>
          <option value="">Any</option>
          <option value="available">Available now</option>
          <option value="busy">Busy</option>
        </Select>
      </Field>
      <Field id="experience" label="Experience">
        <Select id="experience" name="experience" defaultValue={values.experience ?? ""}>
          <option value="">Any</option>
          <option value="entry">Entry level</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </Select>
      </Field>
      <Field id="max" label="Starting price up to ₹">
        <Input id="max" name="max" inputMode="numeric" defaultValue={values.max} placeholder="Any" />
      </Field>
      <Field id="rating" label="Rating">
        <Select id="rating" name="rating" defaultValue={values.rating ?? ""}>
          <option value="">Any (including new)</option>
          <option value="4">4.0 and above</option>
          <option value="4.5">4.5 and above</option>
        </Select>
      </Field>
      <Field id="sort" label="Sort by">
        <Select id="sort" name="sort" defaultValue={values.sort ?? "recommended"}>
          {SPECIALIST_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    </FilterShell>
  );
}
