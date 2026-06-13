import { describe, expect, it } from "vitest";
import { paymentInputSchema, financialsInputSchema } from "./schema";

describe("paymentInputSchema", () => {
  it("accepts a valid incoming payment", () => {
    const r = paymentInputSchema.safeParse({ direction: "incoming", amount: "2000.00", paidAt: "2026-06-03", note: "" });
    expect(r.success).toBe(true);
  });
  it("requires a positive amount", () => {
    expect(paymentInputSchema.safeParse({ direction: "incoming", amount: "0", paidAt: "2026-06-03" }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ direction: "incoming", amount: "-5", paidAt: "2026-06-03" }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ direction: "incoming", amount: "abc", paidAt: "2026-06-03" }).success).toBe(false);
  });
  it("rejects an unknown direction", () => {
    expect(paymentInputSchema.safeParse({ direction: "sideways", amount: "10", paidAt: "2026-06-03" }).success).toBe(false);
  });
  it("requires a date", () => {
    expect(paymentInputSchema.safeParse({ direction: "outgoing", amount: "10", paidAt: "" }).success).toBe(false);
  });
});

describe("financialsInputSchema", () => {
  it("accepts empty amounts (clearing)", () => {
    expect(financialsInputSchema.safeParse({ amountReceivable: "", amountPayable: "" }).success).toBe(true);
  });
  it("accepts numeric amounts", () => {
    expect(financialsInputSchema.safeParse({ amountReceivable: "4200", amountPayable: "2800.50" }).success).toBe(true);
  });
  it("rejects non-numeric amounts", () => {
    expect(financialsInputSchema.safeParse({ amountReceivable: "lots", amountPayable: "" }).success).toBe(false);
  });
});
