import { describe, expect, it } from "vitest";
import { toCents, sumCents, centsToString, formatMoney } from "./money";

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
  it("renders a $ amount with thousands separators and 2 decimals", () => {
    expect(formatMoney(420000)).toBe("$4,200.00");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(-220000)).toBe("-$2,200.00");
  });
});
