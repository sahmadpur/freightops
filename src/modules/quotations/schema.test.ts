import { describe, expect, it } from "vitest";
import { expectedMargin, quotationInputSchema } from "./schema";

const valid = {
  currency: "EUR",
  expectedCostTotal: "2350.00",
  sellingPrice: "2700.00",
  validUntil: "2026-08-31",
  transitTimeDays: "12",
  terms: "Rate valid for one shipment",
  notes: "",
};

describe("quotationInputSchema", () => {
  it("accepts a complete quotation", () => {
    expect(quotationInputSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty one — a quotation is filled in over hours, not at once", () => {
    const r = quotationInputSchema.safeParse({
      currency: "USD",
      expectedCostTotal: "",
      sellingPrice: "",
      validUntil: "",
      transitTimeDays: "",
      terms: "",
      notes: "",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a currency the orders module does not price in", () => {
    expect(quotationInputSchema.safeParse({ ...valid, currency: "GBP" }).success).toBe(false);
  });

  it("rejects non-numeric money and a malformed date", () => {
    expect(quotationInputSchema.safeParse({ ...valid, sellingPrice: "about 2700" }).success).toBe(false);
    expect(quotationInputSchema.safeParse({ ...valid, validUntil: "31/08/2026" }).success).toBe(false);
  });

  it("rejects a fractional transit time", () => {
    expect(quotationInputSchema.safeParse({ ...valid, transitTimeDays: "12.5" }).success).toBe(false);
  });
});

describe("expectedMargin", () => {
  it("computes the specification's worked example", () => {
    // §16: offered EUR 2,700 against an expected cost of EUR 2,350.
    const m = expectedMargin("2700.00", "2350.00");
    expect(m?.amount).toBeCloseTo(350, 2);
    expect(m?.percent).toBeCloseTo(12.96, 1);
  });

  it("reports a loss rather than clamping at zero", () => {
    expect(expectedMargin("2000", "2480")?.amount).toBeCloseTo(-480, 2);
  });

  it("is null until both sides are known — a half-filled quotation has no margin", () => {
    expect(expectedMargin("2700", null)).toBeNull();
    expect(expectedMargin(null, "2350")).toBeNull();
    expect(expectedMargin("", "")).toBeNull();
  });

  it("has no percentage against a zero selling price, but still an amount", () => {
    const m = expectedMargin("0", "100");
    expect(m?.amount).toBeCloseTo(-100, 2);
    expect(m?.percent).toBeNull();
  });
});
