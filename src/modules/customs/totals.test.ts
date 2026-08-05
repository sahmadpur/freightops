import { describe, expect, it } from "vitest";
import { customsTotals } from "./totals";

describe("customsTotals", () => {
  it("sums buy and sell separately and derives the margin", () => {
    expect(
      customsTotals([
        { buyAmount: "40.00", sellAmount: "75.00" },
        { buyAmount: "60.00", sellAmount: "110.00" },
      ]),
    ).toEqual({ buyCents: 10000, sellCents: 18500, marginCents: 8500 });
  });

  it("treats missing amounts as zero — nothing on a clearance is mandatory", () => {
    expect(
      customsTotals([
        { buyAmount: null, sellAmount: "50.00" },
        { buyAmount: "20.00", sellAmount: null },
        { buyAmount: "", sellAmount: "" },
      ]),
    ).toEqual({ buyCents: 2000, sellCents: 5000, marginCents: 3000 });
  });

  it("reports a negative margin when the buy side is larger", () => {
    expect(customsTotals([{ buyAmount: "100.00", sellAmount: "80.00" }]).marginCents).toBe(-2000);
  });

  it("is all zeroes for an empty clearance", () => {
    expect(customsTotals([])).toEqual({ buyCents: 0, sellCents: 0, marginCents: 0 });
  });
});
