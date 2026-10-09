import { describe, expect, it } from "vitest";
import {
  MoneyParseError,
  calculateFeeMinor,
  formatBudgetRange,
  formatMoney,
  minorToMajorInput,
  parseMajorToMinor,
} from "@/lib/domain/money";

describe("parseMajorToMinor", () => {
  it("parses whole and fractional rupees into paise", () => {
    expect(parseMajorToMinor("1500")).toBe(150000);
    expect(parseMajorToMinor("1500.5")).toBe(150050);
    expect(parseMajorToMinor("1500.05")).toBe(150005);
    expect(parseMajorToMinor("₹1,500.50")).toBe(150050);
    expect(parseMajorToMinor(1500)).toBe(150000);
  });

  it("avoids floating point errors", () => {
    // 0.1 + 0.2 style inputs are handled digit-wise.
    expect(parseMajorToMinor("0.29")).toBe(29);
    expect(parseMajorToMinor("19.99")).toBe(1999);
  });

  it("rejects invalid input", () => {
    expect(() => parseMajorToMinor("abc")).toThrow(MoneyParseError);
    expect(() => parseMajorToMinor("10.999")).toThrow(MoneyParseError);
    expect(() => parseMajorToMinor("-5")).toThrow(MoneyParseError);
    expect(() => parseMajorToMinor("")).toThrow(MoneyParseError);
  });
});

describe("formatMoney", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatMoney(150000, "INR")).toBe("₹1,500");
    expect(formatMoney(150050, "INR")).toBe("₹1,500.50");
    expect(formatMoney(1000000000, "INR")).toBe("₹1,00,00,000");
    expect(formatMoney(5, "INR")).toBe("₹0.05");
  });

  it("can force a zero fraction", () => {
    expect(formatMoney(150000, "INR", { showZeroFraction: true })).toBe("₹1,500.00");
  });
});

describe("minorToMajorInput", () => {
  it("round-trips with parseMajorToMinor", () => {
    for (const value of [0, 5, 150000, 150050, 99999999]) {
      expect(parseMajorToMinor(minorToMajorInput(value))).toBe(value);
    }
  });
});

describe("calculateFeeMinor", () => {
  it("returns zero for zero or negative bps", () => {
    expect(calculateFeeMinor(150000, 0)).toBe(0);
    expect(calculateFeeMinor(150000, -10)).toBe(0);
  });

  it("rounds half up using integer maths", () => {
    expect(calculateFeeMinor(150000, 500)).toBe(7500); // 5%
    expect(calculateFeeMinor(333, 1000)).toBe(33); // 33.3 -> 33
    expect(calculateFeeMinor(335, 1000)).toBe(34); // 33.5 -> 34
  });

  it("is exact for very large amounts", () => {
    expect(calculateFeeMinor(9_007_199_254_740_991, 1)).toBe(900_719_925_474);
  });

  it("rejects non-integer amounts", () => {
    expect(() => calculateFeeMinor(10.5, 100)).toThrow(RangeError);
  });
});

describe("formatBudgetRange", () => {
  it("describes ranges and single bounds", () => {
    expect(formatBudgetRange(100000, 200000)).toBe("₹1,000 – ₹2,000");
    expect(formatBudgetRange(null, 200000)).toBe("Up to ₹2,000");
    expect(formatBudgetRange(100000, null)).toBe("From ₹1,000");
    expect(formatBudgetRange(null, null)).toBe("Budget not set");
  });
});
