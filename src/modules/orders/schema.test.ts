import { describe, expect, it } from "vitest";
import { orderInputSchema, statusChangeSchema } from "./schema";

const base = {
  title: "Steel pipes",
  clientOrderId: "",
  accountId: "acc-123",
  carrierId: "",
  route: "Istanbul → Baku",
  cargoDescription: "Steel pipes",
  packages: "24",
  weightKg: "8400",
  volumeM3: "24",
  incoterms: "CIP",
  deliveryFormat: "FTL",
  clientCharge: "4200",
  carrierCost: "2800",
  additionalCosts: "",
  additionalCostsNote: "",
  expectedProfit: "1400",
  invoiceNumber: "",
  invoiceDate: "",
  transport: { mode: "none" },
};

describe("orderInputSchema", () => {
  it("accepts a valid order with no transport", () => {
    expect(orderInputSchema.safeParse(base).success).toBe(true);
  });
  it("requires a title and an accountId", () => {
    expect(orderInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, accountId: "" }).success).toBe(false);
  });
  it("rejects unknown incoterms and delivery format", () => {
    expect(orderInputSchema.safeParse({ ...base, incoterms: "ZZZ" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, deliveryFormat: "BULK" }).success).toBe(false);
  });
  it("allows empty incoterms/deliveryFormat (optional)", () => {
    expect(orderInputSchema.safeParse({ ...base, incoterms: "", deliveryFormat: "" }).success).toBe(true);
  });
  it("rejects non-numeric money fields", () => {
    expect(orderInputSchema.safeParse({ ...base, clientCharge: "lots" }).success).toBe(false);
  });
  it("accepts transport=existing with an id", () => {
    const r = orderInputSchema.safeParse({ ...base, transport: { mode: "existing", transportModeId: "tm-1" } });
    expect(r.success).toBe(true);
  });
  it("rejects transport=existing without an id", () => {
    const r = orderInputSchema.safeParse({ ...base, transport: { mode: "existing", transportModeId: "" } });
    expect(r.success).toBe(false);
  });
  it("accepts transport=new with mode type and number", () => {
    const r = orderInputSchema.safeParse({
      ...base,
      transport: { mode: "new", modeType: "vehicle", number: "TRK-1", fromCountry: "", toCountry: "", route: "", loadingDate: "", plannedArrivalDate: "", totalWeightKg: "", totalVolumeM3: "" },
    });
    expect(r.success).toBe(true);
  });
});

describe("statusChangeSchema", () => {
  it("accepts a valid status", () => {
    expect(statusChangeSchema.safeParse({ status: "transit" }).success).toBe(true);
  });
  it("rejects an unknown status", () => {
    expect(statusChangeSchema.safeParse({ status: "lost" }).success).toBe(false);
  });
});
