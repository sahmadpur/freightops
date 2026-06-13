import { describe, expect, it } from "vitest";
import { ORDER_STATUS_RANK, leastAdvancedStatus } from "./order-status";

describe("ORDER_STATUS_RANK", () => {
  it("orders the lifecycle from created (0) to closed (9)", () => {
    expect(ORDER_STATUS_RANK.created).toBe(0);
    expect(ORDER_STATUS_RANK.closed).toBe(9);
    expect(ORDER_STATUS_RANK.transit).toBeGreaterThan(ORDER_STATUS_RANK.loaded);
    expect(ORDER_STATUS_RANK.at_customs).toBeGreaterThan(ORDER_STATUS_RANK.at_border);
  });
});

describe("leastAdvancedStatus", () => {
  it("returns null for no statuses", () => {
    expect(leastAdvancedStatus([])).toBeNull();
  });
  it("returns the least-advanced status", () => {
    expect(leastAdvancedStatus(["transit", "loaded", "arrived"])).toBe("loaded");
    expect(leastAdvancedStatus(["delivered", "closed"])).toBe("delivered");
    expect(leastAdvancedStatus(["created"])).toBe("created");
  });
});
