import { describe, expect, it } from "vitest";
import { transportModeInputSchema } from "./schema";

const valid = {
  modeType: "vehicle",
  number: "TRK-0188",
  fromCountry: "Türkiye",
  toCountry: "Azerbaijan",
  route: "Istanbul → Baku",
  loadingDate: "2026-06-01",
  plannedArrivalDate: "2026-06-12",
  totalWeightKg: "18000",
  totalVolumeM3: "52",
};

describe("transportModeInputSchema", () => {
  it("accepts a valid transport mode", () => {
    expect(transportModeInputSchema.safeParse(valid).success).toBe(true);
  });
  it("requires modeType to be a known value", () => {
    expect(transportModeInputSchema.safeParse({ ...valid, modeType: "rocket" }).success).toBe(false);
  });
  it("requires a number", () => {
    expect(transportModeInputSchema.safeParse({ ...valid, number: " " }).success).toBe(false);
  });
  it("allows empty optional fields", () => {
    const r = transportModeInputSchema.safeParse({ modeType: "air", number: "AIR-044" });
    expect(r.success).toBe(true);
  });
  it("rejects non-numeric weight", () => {
    expect(transportModeInputSchema.safeParse({ ...valid, totalWeightKg: "heavy" }).success).toBe(false);
  });
});
