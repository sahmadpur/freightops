import { describe, expect, it } from "vitest";
import { orderInputSchema, statusChangeSchema } from "./schema";

const leg = {
  transportType: "road",
  subtype: "ftl",
  originCountry: "TR",
  originCity: "Istanbul",
  destinationCountry: "AZ",
  destinationCity: "Baku",
  vehicleType: "curtainsider",
  vehicleCount: "2",
};

const base = {
  accountId: "acc-123",
  carrierId: "",
  title: "Steel pipes",
  rollbackNumber: "",
  transportFamily: "road",
  legs: [leg],
  cargo: { description: "Construction materials", packages: "24", grossWeightKg: "8400", volumeM3: "24" },
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
  it("rejects unknown incoterms and transport types", () => {
    expect(orderInputSchema.safeParse({ ...base, incoterms: "ZZZ" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, transportFamily: "camel" }).success).toBe(false);
    expect(
      orderInputSchema.safeParse({ ...base, legs: [{ ...leg, transportType: "camel" }] }).success,
    ).toBe(false);
  });
  it("allows empty optional enums", () => {
    const r = orderInputSchema.safeParse({
      ...base,
      incoterms: "",
      transportFamily: "",
      legs: [],
    });
    expect(r.success).toBe(true);
  });
  it("rejects non-numeric money fields", () => {
    expect(orderInputSchema.safeParse({ ...base, clientCharge: "lots" }).success).toBe(false);
  });

  describe("route countries", () => {
    it("accepts known ISO alpha-2 codes and empties", () => {
      const r = orderInputSchema.safeParse({
        ...base,
        legs: [{ ...leg, originCountry: "", destinationCountry: "" }],
      });
      expect(r.success).toBe(true);
    });
    it("upper-cases a lowercase code", () => {
      const r = orderInputSchema.safeParse({ ...base, legs: [{ ...leg, originCountry: "de" }] });
      expect(r.success).toBe(true);
      expect(r.success && r.data.legs[0].originCountry).toBe("DE");
    });
    it("rejects free text and unknown codes", () => {
      expect(
        orderInputSchema.safeParse({ ...base, legs: [{ ...leg, originCountry: "Istanbul" }] }).success,
      ).toBe(false);
      expect(
        orderInputSchema.safeParse({ ...base, legs: [{ ...leg, destinationCountry: "ZZ" }] }).success,
      ).toBe(false);
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

  describe("shipment consistency", () => {
    it("rejects equipment that belongs to another transport type", () => {
      expect(
        orderInputSchema.safeParse({ ...base, legs: [{ ...leg, wagonType: "platform" }] }).success,
      ).toBe(false);
    });
    it("rejects several legs unless the shipment is multimodal", () => {
      expect(orderInputSchema.safeParse({ ...base, legs: [leg, leg] }).success).toBe(false);
      expect(
        orderInputSchema.safeParse({ ...base, transportFamily: "multimodal", legs: [leg, leg] }).success,
      ).toBe(true);
    });
    it("requires the dangerous-goods detail its flag promises", () => {
      const r = orderInputSchema.safeParse({
        ...base,
        cargo: { ...base.cargo, dangerousGoods: true },
      });
      expect(r.success).toBe(false);
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
