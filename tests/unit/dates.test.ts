import { describe, expect, it } from "vitest";
import { endOfDayInTimeZone, toIsoDateInTimeZone } from "@/lib/dates";

describe("endOfDayInTimeZone", () => {
  it("converts an IST calendar date to the end of that day in UTC", () => {
    expect(endOfDayInTimeZone("2026-10-14", "Asia/Kolkata").toISOString()).toBe("2026-10-14T18:29:59.000Z");
  });

  it("handles UTC and DST timezones", () => {
    expect(endOfDayInTimeZone("2026-10-14", "UTC").toISOString()).toBe("2026-10-14T23:59:59.000Z");
    // London is on BST (UTC+1) in July and GMT in December.
    expect(endOfDayInTimeZone("2026-07-01", "Europe/London").toISOString()).toBe("2026-07-01T22:59:59.000Z");
    expect(endOfDayInTimeZone("2026-12-01", "Europe/London").toISOString()).toBe("2026-12-01T23:59:59.000Z");
  });

  it("rejects malformed dates", () => {
    expect(() => endOfDayInTimeZone("14/10/2026", "UTC")).toThrow(RangeError);
  });
});

describe("toIsoDateInTimeZone", () => {
  it("returns the local calendar date", () => {
    expect(toIsoDateInTimeZone(new Date("2026-10-14T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-15");
    expect(toIsoDateInTimeZone(new Date("2026-10-14T20:00:00Z"), "UTC")).toBe("2026-10-14");
  });
});
