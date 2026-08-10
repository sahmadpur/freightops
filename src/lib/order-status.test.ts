import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_RANK,
  RETIRED_ORDER_STATUSES,
  leastAdvancedStatus,
} from "./order-status";
import { REQUEST_STATUSES } from "./request-status";

describe("ORDER_STATUSES", () => {
  it("is the six-stage lifecycle of §15", () => {
    expect([...ORDER_STATUSES]).toEqual([
      "created",
      "operations",
      "booked",
      "in_transit",
      "delivered",
      "closed",
    ]);
  });

  it("shares no value with the request lifecycle, so both can use one badge", () => {
    const requests = new Set<string>(REQUEST_STATUSES);
    expect(ORDER_STATUSES.filter((s) => requests.has(s))).toEqual([]);
  });

  it("keeps the retired stages separate from the live ones", () => {
    const live = new Set<string>(ORDER_STATUSES);
    expect(RETIRED_ORDER_STATUSES.filter((s) => live.has(s))).toEqual([]);
  });
});

describe("ORDER_STATUS_RANK", () => {
  it("orders the lifecycle from created (0) to closed (5)", () => {
    expect(ORDER_STATUS_RANK.created).toBe(0);
    expect(ORDER_STATUS_RANK.closed).toBe(5);
    expect(ORDER_STATUS_RANK.operations).toBeGreaterThan(ORDER_STATUS_RANK.created);
    expect(ORDER_STATUS_RANK.in_transit).toBeGreaterThan(ORDER_STATUS_RANK.booked);
    expect(ORDER_STATUS_RANK.delivered).toBeGreaterThan(ORDER_STATUS_RANK.in_transit);
  });
});

describe("leastAdvancedStatus", () => {
  it("returns null for no statuses", () => {
    expect(leastAdvancedStatus([])).toBeNull();
  });
  it("returns the least-advanced status", () => {
    expect(leastAdvancedStatus(["in_transit", "booked", "delivered"])).toBe("booked");
    expect(leastAdvancedStatus(["delivered", "closed"])).toBe("delivered");
    expect(leastAdvancedStatus(["created"])).toBe("created");
  });
});
