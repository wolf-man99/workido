import { UserSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SpecialistCard } from "@/components/marketplace/cards";
import { SpecialistFilters } from "@/components/marketplace/filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Container, PageHeader, Pagination } from "@/components/ui/misc";
import { listCategories, listSkills, searchSpecialists } from "@/lib/data/marketplace";
import { parseSpecialistFilters, withParams } from "@/lib/validation/filters";

export const metadata: Metadata = { title: "Find specialists", description: "Discover skilled, available specialists for small professional tasks." };

const PAGE_SIZE = 12;

export default async function SpecialistsPage(props: PageProps<"/specialists">) {
  const params = await props.searchParams;
  const filters = parseSpecialistFilters(params);
  const [{ items, total }, categories, skills] = await Promise.all([
    searchSpecialists({ ...filters, pageSize: PAGE_SIZE }),
    listCategories(),
    listSkills(),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeader title="Find specialists" description="Browse people who can get your task done. Rather get a shortlist? Post a task and we'll match you." />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <SpecialistFilters
            categories={categories}
            skills={skills}
            values={{
              q: filters.q,
              category: filters.category,
              skill: filters.skill,
              availability: filters.availability,
              experience: filters.experience,
              max: filters.maxRupees?.toString(),
              rating: filters.minRating?.toString(),
              sort: filters.sort,
            }}
          />
        </aside>
        <section className="flex flex-col gap-5" aria-label="Results">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {total === 0 ? "No specialists found" : `${total} specialist${total === 1 ? "" : "s"} found`}
          </p>
          {items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((specialist) => (
                <SpecialistCard key={specialist.specialist_id} specialist={specialist} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={UserSearch}
              title="No specialists match these filters"
              description="Try widening your search, or post a task to get a matched shortlist."
              action={
                <Button asChild>
                  <Link href="/dashboard/buyer/requirements/new">Post a task</Link>
                </Button>
              }
            />
          )}
          <Pagination page={filters.page ?? 1} pageSize={PAGE_SIZE} total={total} hrefForPage={(page) => withParams("/specialists", params, { page: String(page) })} />
        </section>
      </div>
    </Container>
  );
}
