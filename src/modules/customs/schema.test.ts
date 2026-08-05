import { describe, expect, it } from "vitest";
import { customsClearanceInputSchema } from "./schema";

const base = {
  orderId: "",
  accountId: "acc-1",
  declarationNumber: "AZ-2026-118842",
  description: "Import clearance",
  currency: "USD",
  exchangeRate: "1.7000",
  clearedAt: "2026-07-14",
  notes: "",
  items: [{ category: "broker_fee", buyAmount: "120.00", sellAmount: "200.00", note: "" }],
};

describe("customsClearanceInputSchema", () => {
  it("accepts a standalone clearance against a client", () => {
    expect(customsClearanceInputSchema.safeParse(base).success).toBe(true);
  });

  it("accepts one attached to an order with no client", () => {
    const r = customsClearanceInputSchema.safeParse({ ...base, accountId: "", orderId: "ord-1" });
    expect(r.success).toBe(true);
  });

  it("requires either an order or a client", () => {
    const r = customsClearanceInputSchema.safeParse({ ...base, accountId: "", orderId: "" });
    expect(r.success).toBe(false);
  });

  it("makes every cost field optional — nothing on a clearance is mandatory", () => {
    const r = customsClearanceInputSchema.safeParse({
      ...base,
      declarationNumber: "",
      description: "",
      clearedAt: "",
      exchangeRate: "",
      items: [{ category: "handling", buyAmount: "", sellAmount: "", note: "" }],
    });
    expect(r.success).toBe(true);
  });

  it("defaults items to an empty list", () => {
    const { items, ...withoutItems } = base;
    void items;
    const r = customsClearanceInputSchema.safeParse(withoutItems);
    expect(r.success && r.data.items).toEqual([]);
  });

  it("rejects an unknown category", () => {
    const r = customsClearanceInputSchema.safeParse({
      ...base,
      items: [{ category: "coffee", buyAmount: "1", sellAmount: "2", note: "" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-numeric amounts and unsupported currencies", () => {
    expect(
      customsClearanceInputSchema.safeParse({
        ...base,
        items: [{ category: "handling", buyAmount: "free", sellAmount: "", note: "" }],
      }).success,
    ).toBe(false);
    expect(customsClearanceInputSchema.safeParse({ ...base, currency: "GBP" }).success).toBe(false);
  });
});
