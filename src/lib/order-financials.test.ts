import { describe, expect, it } from "vitest";
import { financialDataIncomplete, missingFinancials } from "./order-financials";

describe("missingFinancials", () => {
  it("names both sides of a direct order created with no numbers", () => {
    expect(missingFinancials({ clientCharge: null, carrierCost: null })).toEqual([
      "clientCharge",
      "carrierCost",
    ]);
  });

  it("names only what is still missing", () => {
    expect(missingFinancials({ clientCharge: "2700.00", carrierCost: null })).toEqual(["carrierCost"]);
    expect(missingFinancials({ clientCharge: null, carrierCost: "2350.00" })).toEqual(["clientCharge"]);
  });

  it("is satisfied once both are recorded", () => {
    expect(missingFinancials({ clientCharge: "2700.00", carrierCost: "2480.00" })).toEqual([]);
  });

  it("treats a recorded zero as answered, not as blank", () => {
    expect(missingFinancials({ clientCharge: "0.00", carrierCost: "0" })).toEqual([]);
  });

  it("treats whitespace as blank", () => {
    expect(missingFinancials({ clientCharge: "  ", carrierCost: "10" })).toEqual(["clientCharge"]);
  });
});

describe("financialDataIncomplete", () => {
  it("drives the §16 indicator", () => {
    expect(financialDataIncomplete({ clientCharge: null, carrierCost: null })).toBe(true);
    expect(financialDataIncomplete({ clientCharge: "2700", carrierCost: null })).toBe(true);
    expect(financialDataIncomplete({ clientCharge: "2700", carrierCost: "2480" })).toBe(false);
  });
});
