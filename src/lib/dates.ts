/**
 * Date helpers without a timezone library. Deadlines are entered as calendar
 * dates and stored as the end of that day (23:59:59) in the app timezone.
 */

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "2026-10-14" in Asia/Kolkata -> 2026-10-14T18:29:59.000Z */
export function endOfDayInTimeZone(isoDate: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new RangeError("Expected a YYYY-MM-DD date");
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const naive = Date.UTC(y, m - 1, d, 23, 59, 59);
  // Two passes handle offsets that change around DST boundaries.
  let result = naive - offsetMinutes(new Date(naive), timeZone) * 60000;
  result = naive - offsetMinutes(new Date(result), timeZone) * 60000;
  return new Date(result);
}

/** Calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function toIsoDateInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}
