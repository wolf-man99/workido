import type { Metadata } from "next";
import Link from "next/link";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { EmptyState } from "@/components/ui/feedback";
import { Container, PageHeader } from "@/components/ui/misc";
import { listCategories } from "@/lib/data/marketplace";

export const metadata: Metadata = { title: "Categories", description: "Browse professional services by category." };

export default async function CategoriesPage() {
  const categories = await listCategories();
  const parents = categories.filter((category) => !category.parent_id);

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeader title="Categories" description="Find the right kind of specialist for your task." />
      {parents.length === 0 ? (
        <EmptyState title="No categories yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parents.map((parent) => {
            const children = categories.filter((category) => category.parent_id === parent.id);
            return (
              <div key={parent.id} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
                <Link href={`/categories/${parent.slug}`} className="group flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-text group-hover:bg-brand group-hover:text-ink">
                    <CategoryIcon icon={parent.icon} className="size-5" />
                  </span>
                  <span className="font-display text-lg font-bold group-hover:underline">{parent.name}</span>
                </Link>
                {parent.description ? <p className="text-sm text-muted-foreground">{parent.description}</p> : null}
                {children.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link href={`/categories/${child.slug}`} className="inline-flex rounded-full bg-mist px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-ink hover:text-cream">
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}
