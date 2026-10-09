import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/misc";
import { listCategories, listSkills, searchServices } from "@/lib/data/marketplace";
import { parseGigFilters, withParams } from "@/lib/validation/filters";
import { ServiceCard } from "./cards";
import { GigFilters } from "./filters";

type RawParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 12;

/** Gig search results + filters, shared by /gigs and /categories/[slug]. */
export async function GigBrowser({ path, params, fixedCategory }: { path: string; params: RawParams; fixedCategory?: string }) {
  const filters = parseGigFilters(params);
  if (fixedCategory) filters.category = fixedCategory;

  const [{ items, total }, categories, skills] = await Promise.all([
    searchServices({ ...filters, pageSize: PAGE_SIZE }),
    listCategories(),
    listSkills(),
  ]);

  const values: Record<string, string | undefined> = {
    q: filters.q,
    category: filters.category,
    skill: filters.skill,
    min: filters.minRupees?.toString(),
    max: filters.maxRupees?.toString(),
    delivery: filters.maxDeliveryHours?.toString(),
    rating: filters.minRating?.toString(),
    availability: filters.availability,
    sort: filters.sort,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <GigFilters action={path} values={values} categories={categories} skills={skills} hideCategory={Boolean(fixedCategory)} />
      </aside>
      <section className="flex flex-col gap-5" aria-label="Results">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total === 0 ? "No gigs found" : `${total} gig${total === 1 ? "" : "s"} found`}
        </p>
        {items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((service) => (
              <ServiceCard key={service.service_id} service={service} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={SearchX}
            title="No gigs match these filters"
            description="Try widening your filters, or post your task and get matched with suitable specialists."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link href={path}>Clear filters</Link>
                </Button>
                <Button asChild>
                  <Link href="/dashboard/buyer/requirements/new">Post a task</Link>
                </Button>
              </div>
            }
          />
        )}
        <Pagination page={filters.page ?? 1} pageSize={PAGE_SIZE} total={total} hrefForPage={(page) => withParams(path, params, { page: String(page) })} />
      </section>
    </div>
  );
}
