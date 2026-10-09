import { describe, expect, it } from "vitest";
import { parseGigFilters, parseSpecialistFilters, withParams } from "@/lib/validation/filters";

describe("parseGigFilters", () => {
  it("parses valid filters and converts rupees to paise", () => {
    const filters = parseGigFilters({ q: "carousel", category: "graphic-design", min: "500", max: "2000", delivery: "72", rating: "4", availability: "available", sort: "price_asc", page: "2" });
    expect(filters).toMatchObject({
      q: "carousel",
      category: "graphic-design",
      minPriceMinor: 50000,
      maxPriceMinor: 200000,
      maxDeliveryHours: 72,
      minRating: 4,
      availability: "available",
      sort: "price_asc",
      page: 2,
    });
  });

  it("ignores invalid or malicious values", () => {
    const filters = parseGigFilters({ category: "../etc", min: "-5", max: "abc", rating: "9", availability: "maybe", sort: "drop table", page: "0" });
    expect(filters.category).toBeUndefined();
    expect(filters.minPriceMinor).toBeUndefined();
    expect(filters.maxPriceMinor).toBeUndefined();
    expect(filters.minRating).toBeUndefined();
    expect(filters.availability).toBeUndefined();
    expect(filters.sort).toBe("recommended");
    expect(filters.page).toBe(1);
  });
});

describe("parseSpecialistFilters", () => {
  it("parses experience and price", () => {
    expect(parseSpecialistFilters({ experience: "expert", max: "3000" })).toMatchObject({ experience: "expert", maxStartingPriceMinor: 300000 });
  });
});

describe("withParams", () => {
  it("preserves existing filters while changing the page", () => {
    expect(withParams("/gigs", { q: "logo", page: "1" }, { page: "2" })).toBe("/gigs?q=logo&page=2");
    expect(withParams("/gigs", { q: "logo" }, { q: undefined })).toBe("/gigs");
  });
});
