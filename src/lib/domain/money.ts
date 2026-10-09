/**
 * Money helpers. Amounts are always integer minor units (e.g. paise) paired
 * with an ISO-4217 currency code. No floating-point arithmetic is used for
 * calculations; formatting works on the integer's digits.
 */

export const DEFAULT_CURRENCY = "INR";

/** Minor units per major unit. Every currency Workido supports uses 2. */
const MINOR_DIGITS: Record<string, number> = { INR: 2, USD: 2, EUR: 2, GBP: 2 };

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export class MoneyParseError extends Error {}

function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

/**
 * Parses a user-entered major-unit amount ("1,500", "1500.5", "₹1500.50")
 * into integer minor units without floating-point maths.
 */
export function parseMajorToMinor(input: string | number, currency = DEFAULT_CURRENCY): number {
  const digits = minorDigits(currency);
  const raw = String(input).trim().replace(/[₹$€£,\s]/g, "");
  const match = /^(\d{1,12})(?:\.(\d{0,2}))?$/.exec(raw);
  if (!match) {
    throw new MoneyParseError("Enter an amount like 1500 or 1500.50");
  }
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(digits, "0").slice(0, digits);
  const value = Number(whole) * 10 ** digits + Number(fraction || "0");
  if (!Number.isSafeInteger(value)) {
    throw new MoneyParseError("Amount is too large");
  }
  return value;
}

/** Converts minor units to a plain major-unit string for form inputs ("1500.50" / "1500"). */
export function minorToMajorInput(minor: number, currency = DEFAULT_CURRENCY): string {
  const digits = minorDigits(currency);
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor)).toString().padStart(digits + 1, "0");
  const whole = abs.slice(0, -digits);
  const fraction = abs.slice(-digits);
  const text = /^0+$/.test(fraction) ? whole : `${whole}.${fraction}`;
  return negative ? `-${text}` : text;
}

/**
 * Formats minor units for display, e.g. 150000 INR -> "₹1,500" and
 * 150050 -> "₹1,500.50". Grouping follows the Indian system for INR.
 */
export function formatMoney(minor: number, currency = DEFAULT_CURRENCY, options: { showZeroFraction?: boolean } = {}): string {
  const digits = minorDigits(currency);
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor)).toString().padStart(digits + 1, "0");
  const whole = abs.slice(0, -digits);
  const fraction = abs.slice(-digits);
  const locale = currency === "INR" ? "en-IN" : "en-US";
  // Grouping a whole-number string is exact (no fractional component).
  const groupedWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(whole));
  const showFraction = options.showZeroFraction || !/^0+$/.test(fraction);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${negative ? "-" : ""}${symbol}${groupedWhole}${showFraction ? `.${fraction}` : ""}`;
}

/**
 * Basis-point fee, rounded half-up, computed with BigInt so the result is
 * exact for any amount. Mirrors public.calculate_fee_minor() in the database.
 */
export function calculateFeeMinor(amountMinor: number, bps: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("amountMinor must be a non-negative safe integer");
  }
  if (!Number.isInteger(bps) || bps <= 0) return 0;
  return Number((BigInt(amountMinor) * BigInt(bps) + BigInt(5000)) / BigInt(10000));
}

export function formatBudgetRange(minMinor: number | null, maxMinor: number | null, currency = DEFAULT_CURRENCY): string {
  if (minMinor !== null && maxMinor !== null && minMinor !== maxMinor) {
    return `${formatMoney(minMinor, currency)} – ${formatMoney(maxMinor, currency)}`;
  }
  if (maxMinor !== null) return `Up to ${formatMoney(maxMinor, currency)}`;
  if (minMinor !== null) return `From ${formatMoney(minMinor, currency)}`;
  return "Budget not set";
}
