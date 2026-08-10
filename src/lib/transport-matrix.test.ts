import { describe, expect, it } from "vitest";
import {
  chargeableWeight,
  DEFAULT_VOLUMETRIC_DIVISOR,
  isSubtypeOf,
  legFields,
  LEG_TRANSPORT_TYPES,
  RAIL_CONTAINER_TYPES,
  subtypesFor,
  TRANSPORT_SUBTYPES,
} from "./transport-matrix";

describe("the subtype matrix", () => {
  it("covers every subtype exactly once across the transport types", () => {
    const all = LEG_TRANSPORT_TYPES.flatMap((t) => [...subtypesFor(t)]);
    expect(all.slice().sort()).toEqual([...TRANSPORT_SUBTYPES].sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives air no subtype — Appendix A lists none", () => {
    expect(subtypesFor("air")).toEqual([]);
  });

  it("rejects a subtype belonging to another transport type", () => {
    expect(isSubtypeOf("road", "ftl")).toBe(true);
    expect(isSubtypeOf("road", "fcl")).toBe(false);
    expect(isSubtypeOf("sea", "roro")).toBe(true);
    expect(isSubtypeOf("rail", "wagon")).toBe(true);
    expect(isSubtypeOf("rail", "ltl")).toBe(false);
    expect(isSubtypeOf("air", "ftl")).toBe(false);
  });

  it("offers rail a narrower container list than sea", () => {
    expect(RAIL_CONTAINER_TYPES).not.toContain("20rf");
    expect(RAIL_CONTAINER_TYPES).not.toContain("flat_rack");
    expect(legFields("rail", "rail_container").containerOptions).toBe(RAIL_CONTAINER_TYPES);
    expect(legFields("sea", "fcl").containerOptions).toContain("20rf");
  });
});

describe("legFields", () => {
  it("opens vehicle inputs for road FTL only", () => {
    expect(legFields("road", "ftl").vehicle).toBe(true);
    expect(legFields("road", "ltl").vehicle).toBe(false);
  });

  it("opens containers for FCL and rail containers, wagons for rail wagons", () => {
    expect(legFields("sea", "fcl").containers).toBe(true);
    expect(legFields("sea", "lcl").containers).toBe(false);
    expect(legFields("rail", "rail_container").containers).toBe(true);
    expect(legFields("rail", "wagon").wagons).toBe(true);
    expect(legFields("rail", "rail_container").wagons).toBe(false);
  });

  it("opens the equipment description for Ro-Ro only", () => {
    expect(legFields("sea", "roro").equipment).toBe(true);
    expect(legFields("sea", "breakbulk").equipment).toBe(false);
  });

  it("names the point column after the transport type", () => {
    expect(legFields("road", "ftl").pointKind).toBeNull();
    expect(legFields("sea", "fcl").pointKind).toBe("port");
    expect(legFields("rail", "wagon").pointKind).toBe("station");
    expect(legFields("air", "").pointKind).toBe("airport");
  });

  it("opens the air-only fields for air, whatever the subtype box holds", () => {
    expect(legFields("air", "").air).toBe(true);
    expect(legFields("sea", "fcl").air).toBe(false);
  });

  it("still returns the shared fields while no subtype is chosen", () => {
    expect(legFields("sea", "").pointKind).toBe("port");
    expect(legFields("sea", "").containers).toBe(false);
  });
});

describe("chargeableWeight", () => {
  it("takes the greater of actual and volumetric weight", () => {
    // 1 m³ at the IATA divisor is 166.67 kg — heavier than 100 kg of actual weight.
    expect(chargeableWeight(100, 1)).toBeCloseTo(1_000_000 / DEFAULT_VOLUMETRIC_DIVISOR, 2);
    expect(chargeableWeight(500, 1)).toBe(500);
  });

  it("honours a negotiated divisor", () => {
    expect(chargeableWeight(0, 1, 5000)).toBe(200);
    expect(chargeableWeight(0, 1, 6000)).toBeCloseTo(166.67, 1);
  });

  it("works from either input alone", () => {
    expect(chargeableWeight(250, null)).toBe(250);
    expect(chargeableWeight(null, 3)).toBeCloseTo(500, 0);
  });

  it("is null when nothing is known", () => {
    expect(chargeableWeight(null, null)).toBeNull();
  });

  it("ignores a zero divisor rather than dividing by it", () => {
    expect(chargeableWeight(80, 2, 0)).toBe(80);
  });
});
