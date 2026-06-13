import { describe, expect, it } from "vitest";
import { actualProfitCents, balance, paymentStatus } from "./finance";

describe("actualProfitCents", () => {
  it("is client charge minus carrier cost minus additional costs", () => {
    expect(actualProfitCents("4200", "2800", "0")).toBe(140000);
    expect(actualProfitCents("4200.00", "2800.00", "100.00")).toBe(130000);
  });
  it("treats null fields as 0", () => {
    expect(actualProfitCents("4200", null, null)).toBe(420000);
    expect(actualProfitCents(null, null, null)).toBe(0);
  });
});

describe("balance", () => {
  it("returns invoiced, paid, and delta in cents", () => {
    expect(balance("4200", ["2000"])).toEqual({ invoicedCents: 420000, paidCents: 200000, deltaCents: 220000 });
  });
  it("delta is negative when overpaid", () => {
    expect(balance("100", ["150"]).deltaCents).toBe(-5000);
  });
  it("handles no invoice amount and no payments", () => {
    expect(balance(null, [])).toEqual({ invoicedCents: 0, paidCents: 0, deltaCents: 0 });
  });
});

describe("paymentStatus", () => {
  it("is null when no amount is invoiced", () => {
    expect(paymentStatus(0, 0)).toBeNull();
  });
  it("is not_paid when nothing is paid", () => {
    expect(paymentStatus(420000, 0)).toBe("not_paid");
  });
  it("is partly_paid when partially paid", () => {
    expect(paymentStatus(420000, 200000)).toBe("partly_paid");
  });
  it("is paid when fully or over paid", () => {
    expect(paymentStatus(420000, 420000)).toBe("paid");
    expect(paymentStatus(420000, 500000)).toBe("paid");
  });
});
