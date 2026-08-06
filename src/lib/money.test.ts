import { describe, expect, it } from "vitest";
import { toCents, sumCents, centsToString, formatMoney, formatMoneyAzn, convertToAzn, convertCents } from "./money";

describe("toCents", () => {
  it("parses numeric strings to integer cents", () => {
    expect(toCents("4200.00")).toBe(420000);
    expect(toCents("4200")).toBe(420000);
    expect(toCents("0.01")).toBe(1);
    expect(toCents("12.34")).toBe(1234);
  });
  it("treats null/empty as 0", () => {
    expect(toCents(null)).toBe(0);
    expect(toCents("")).toBe(0);
  });
  it("rounds to the nearest cent (no float drift)", () => {
    expect(toCents("0.1")).toBe(10);
    expect(toCents("1.005")).toBe(101);
  });
});

describe("sumCents", () => {
  it("sums a list of numeric strings exactly", () => {
    expect(sumCents(["0.1", "0.2"])).toBe(30);
    expect(sumCents(["4200.00", "2800.50", null, ""])).toBe(700050);
  });
});

describe("centsToString", () => {
  it("formats cents back to a 2-decimal string", () => {
    expect(centsToString(420000)).toBe("4200.00");
    expect(centsToString(1)).toBe("0.01");
    expect(centsToString(-2200_00)).toBe("-2200.00");
  });
});

describe("formatMoney", () => {
  it("defaults to USD with thousands separators and 2 decimals", () => {
    expect(formatMoney(420000)).toBe("$4,200.00");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(-220000)).toBe("-$2,200.00");
  });
  it("uses the symbol of the given currency", () => {
    expect(formatMoney(420000, "EUR")).toBe("€4,200.00");
    expect(formatMoney(420000, "AZN")).toBe("₼4,200.00");
    expect(formatMoney(420000, "RUB")).toBe("₽4,200.00");
    expect(formatMoney(-5000, "TRY")).toBe("-₺50.00");
  });
  it("falls back to the code for a currency with no symbol", () => {
    expect(formatMoney(420000, "GBP")).toBe("GBP 4,200.00");
  });
});

describe("formatMoneyAzn", () => {
  it("renders a ₼ amount with grouping", () => {
    expect(formatMoneyAzn(714000)).toBe("₼7,140.00");
    expect(formatMoneyAzn(-5000)).toBe("-₼50.00");
  });
});

describe("convertToAzn", () => {
  it("converts cents to AZN cents at the rate (string or number)", () => {
    expect(convertToAzn(420000, 1.7)).toBe(714000);
    expect(convertToAzn(420000, "1.7000")).toBe(714000);
    expect(convertToAzn(100, 1.705)).toBe(171);
  });
  it("returns null for missing, zero, or invalid rates", () => {
    expect(convertToAzn(420000, null)).toBeNull();
    expect(convertToAzn(420000, "")).toBeNull();
    expect(convertToAzn(420000, 0)).toBeNull();
    expect(convertToAzn(420000, "abc")).toBeNull();
  });
});

describe("convertCents", () => {
  it("cross-converts through AZN", () => {
    // 100.00 USD at 1.70 AZN/USD → 170.00 AZN → 100.00 EUR at 1.70 AZN/EUR.
    expect(convertCents(10000, 1.7, 1.7)).toBe(10000);
    // 100.00 USD at 1.70 → 170.00 AZN → 1.85 AZN/EUR → 91.89 EUR.
    expect(convertCents(10000, 1.7, 1.85)).toBe(9189);
  });
  it("treats AZN as the identity rate", () => {
    expect(convertCents(10000, 1.7, 1)).toBe(17000);
    expect(convertCents(17000, 1, 1.7)).toBe(10000);
  });
  it("rejects non-positive or non-finite rates", () => {
    expect(() => convertCents(100, 0, 1.7)).toThrow();
    expect(() => convertCents(100, 1.7, 0)).toThrow();
    expect(() => convertCents(100, Number.NaN, 1.7)).toThrow();
  });
});
