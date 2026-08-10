import { describe, expect, it } from "vitest";
import { orderInputSchema, statusChangeSchema } from "./schema";

const base = {
  transportType: "truck",
  accountId: "acc-123",
  carrierId: "",
  fromCountry: "TR",
  toCountry: "AZ",
  title: "Steel pipes",
  rollbackNumber: "",
  deliveryFormat: "FTL",
  cargoItems: ["Construction materials"],
  packages: "24",
  weightKg: "8400",
  volumeM3: "24",
  incoterms: "CIP",
  currency: "USD",
  exchangeRate: "1.7000",
  clientCharge: "4200",
  costLines: [],
};

describe("orderInputSchema", () => {
  it("accepts a valid order", () => {
    expect(orderInputSchema.safeParse(base).success).toBe(true);
  });
  it("requires a title and an accountId", () => {
    expect(orderInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, accountId: "" }).success).toBe(false);
  });
  it("rejects unknown incoterms, delivery format and transport type", () => {
    expect(orderInputSchema.safeParse({ ...base, incoterms: "ZZZ" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, deliveryFormat: "BULK" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, transportType: "camel" }).success).toBe(false);
  });
  it("allows empty optional enums", () => {
    const r = orderInputSchema.safeParse({
      ...base,
      incoterms: "",
      deliveryFormat: "",
      transportType: "",
    });
    expect(r.success).toBe(true);
  });
  it("rejects non-numeric money fields", () => {
    expect(orderInputSchema.safeParse({ ...base, clientCharge: "lots" }).success).toBe(false);
  });

  describe("route countries", () => {
    it("accepts known ISO alpha-2 codes and empties", () => {
      expect(orderInputSchema.safeParse({ ...base, fromCountry: "", toCountry: "" }).success).toBe(true);
    });
    it("upper-cases a lowercase code", () => {
      const r = orderInputSchema.safeParse({ ...base, fromCountry: "de" });
      expect(r.success).toBe(true);
      expect(r.success && r.data.fromCountry).toBe("DE");
    });
    it("rejects free text and unknown codes", () => {
      expect(orderInputSchema.safeParse({ ...base, fromCountry: "Istanbul" }).success).toBe(false);
      expect(orderInputSchema.safeParse({ ...base, toCountry: "ZZ" }).success).toBe(false);
    });
  });

  describe("currency", () => {
    it("accepts a supported currency", () => {
      expect(orderInputSchema.safeParse({ ...base, currency: "EUR" }).success).toBe(true);
    });
    it("rejects an unsupported one", () => {
      expect(orderInputSchema.safeParse({ ...base, currency: "GBP" }).success).toBe(false);
    });
    it("takes a rate with up to 4 decimals", () => {
      expect(orderInputSchema.safeParse({ ...base, exchangeRate: "1.70005" }).success).toBe(false);
      expect(orderInputSchema.safeParse({ ...base, exchangeRate: "" }).success).toBe(true);
    });
  });

  describe("cargo items", () => {
    it("defaults to an empty list", () => {
      const { cargoItems, ...withoutCargo } = base;
      void cargoItems;
      const r = orderInputSchema.safeParse(withoutCargo);
      expect(r.success && r.data.cargoItems).toEqual([]);
    });
    it("rejects blank entries", () => {
      expect(orderInputSchema.safeParse({ ...base, cargoItems: [""] }).success).toBe(false);
    });
  });

  describe("agent expense lines", () => {
    it("accepts categorized lines", () => {
      const r = orderInputSchema.safeParse({
        ...base,
        costLines: [{ category: "broker", amount: "120.50", note: "Clearance" }],
      });
      expect(r.success).toBe(true);
    });
    it("rejects an unknown category", () => {
      const r = orderInputSchema.safeParse({
        ...base,
        costLines: [{ category: "bribes", amount: "10", note: "" }],
      });
      expect(r.success).toBe(false);
    });
    it("rejects a non-numeric amount", () => {
      const r = orderInputSchema.safeParse({
        ...base,
        costLines: [{ category: "broker", amount: "some", note: "" }],
      });
      expect(r.success).toBe(false);
    });
  });
});

describe("statusChangeSchema", () => {
  it("accepts every stage of the §15 lifecycle", () => {
    for (const status of ["created", "operations", "booked", "in_transit", "delivered", "closed"]) {
      expect(statusChangeSchema.safeParse({ status }).success).toBe(true);
    }
  });
  it("rejects the stages retired when the lifecycle was reduced", () => {
    expect(statusChangeSchema.safeParse({ status: "at_customs" }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ status: "waiting_pickup" }).success).toBe(false);
  });
  it("rejects a request status — the two lifecycles are separate", () => {
    expect(statusChangeSchema.safeParse({ status: "lost" }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ status: "quotation" }).success).toBe(false);
  });
});
