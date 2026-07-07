import { describe, expect, it } from "vitest";
import { balance, expectedProfitCents, paymentStatus, settledProfitCents } from "./finance";

describe("expectedProfitCents", () => {
  it("is client charge minus carrier cost", () => {
    expect(expectedProfitCents("4200", "2800")).toBe(140000);
    expect(expectedProfitCents("4200.00", "2900.00")).toBe(130000);
  });
  it("treats null fields as 0", () => {
    expect(expectedProfitCents("4200", null)).toBe(420000);
    expect(expectedProfitCents(null, null)).toBe(0);
  });
});

describe("settledProfitCents", () => {
  it("is amount receivable minus amount payable", () => {
    expect(settledProfitCents("4200", "2800")).toBe(140000);
    expect(settledProfitCents("4200", null)).toBe(420000);
    expect(settledProfitCents(null, null)).toBe(0);
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
