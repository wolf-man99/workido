import { z } from "zod";
import type { ServiceSearchParams, ServiceSort, SpecialistSearchParams, SpecialistSort } from "@/lib/data/marketplace";

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === undefined || v.trim() === "" ? undefined : v.trim();
}

const rupees = z.coerce.number().int().min(0).max(10_000_000);
const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const page = z.coerce.number().int().min(1).max(1000);
const availability = z.enum(["available", "busy", "unavailable"]);
const rating = z.coerce.number().min(1).max(5);

function safe<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export const GIG_SORTS: { value: ServiceSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "delivery", label: "Fastest delivery" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
];

export const DELIVERY_OPTIONS = [
  { value: "24", label: "Within 24 hours" },
  { value: "72", label: "Up to 3 days" },
  { value: "168", label: "Up to 7 days" },
];

/** Parses /gigs query parameters; invalid values are ignored, never trusted. */
export function parseGigFilters(params: RawParams): ServiceSearchParams & { minRupees?: number; maxRupees?: number } {
  const minRupees = safe(rupees, first(params.min));
  const maxRupees = safe(rupees, first(params.max));
  const sort = first(params.sort);
  return {
    q: first(params.q)?.slice(0, 80),
    category: safe(slug, first(params.category)),
    skill: safe(slug, first(params.skill)),
    minRupees,
    maxRupees,
    minPriceMinor: minRupees !== undefined ? minRupees * 100 : undefined,
    maxPriceMinor: maxRupees !== undefined ? maxRupees * 100 : undefined,
    maxDeliveryHours: safe(z.coerce.number().int().min(1).max(2160), first(params.delivery)),
    minRating: safe(rating, first(params.rating)),
    availability: safe(availability, first(params.availability)),
    sort: GIG_SORTS.some((option) => option.value === sort) ? (sort as ServiceSort) : "recommended",
    page: safe(page, first(params.page)) ?? 1,
  };
}

export const SPECIALIST_SORTS: { value: SpecialistSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Lowest starting price" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
];

export function parseSpecialistFilters(params: RawParams): SpecialistSearchParams & { maxRupees?: number } {
  const maxRupees = safe(rupees, first(params.max));
  const sort = first(params.sort);
  return {
    q: first(params.q)?.slice(0, 80),
    skill: safe(slug, first(params.skill)),
    category: safe(slug, first(params.category)),
    availability: safe(availability, first(params.availability)),
    experience: safe(z.enum(["entry", "intermediate", "expert"]), first(params.experience)),
    minRating: safe(rating, first(params.rating)),
    maxRupees,
    maxStartingPriceMinor: maxRupees !== undefined ? maxRupees * 100 : undefined,
    sort: SPECIALIST_SORTS.some((option) => option.value === sort) ? (sort as SpecialistSort) : "recommended",
    page: safe(page, first(params.page)) ?? 1,
  };
}

/** Builds a URL with updated query parameters (used for pagination links). */
export function withParams(path: string, params: RawParams, updates: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v !== undefined) search.set(key, v);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) search.delete(key);
    else search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
