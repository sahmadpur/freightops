import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_RANK,
  RETIRED_ORDER_STATUSES,
  leastAdvancedStatus,
} from "./order-status";
import { REQUEST_STATUSES } from "./request-status";

describe("ORDER_STATUSES", () => {
  it("is the eight-stage lifecycle of the corrections round", () => {
    expect([...ORDER_STATUSES]).toEqual([
      "created",
      "waiting_pickup",
      "en_route",
      "in_transit",
      "ferry_wait",
      "at_customs",
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
  it("orders the lifecycle from created (0) to closed (7)", () => {
    expect(ORDER_STATUS_RANK.created).toBe(0);
    expect(ORDER_STATUS_RANK.closed).toBe(7);
    expect(ORDER_STATUS_RANK.waiting_pickup).toBeGreaterThan(ORDER_STATUS_RANK.created);
    expect(ORDER_STATUS_RANK.in_transit).toBeGreaterThan(ORDER_STATUS_RANK.en_route);
    expect(ORDER_STATUS_RANK.at_customs).toBeGreaterThan(ORDER_STATUS_RANK.ferry_wait);
    expect(ORDER_STATUS_RANK.delivered).toBeGreaterThan(ORDER_STATUS_RANK.in_transit);
  });
});

describe("leastAdvancedStatus", () => {
  it("returns null for no statuses", () => {
    expect(leastAdvancedStatus([])).toBeNull();
  });
  it("returns the least-advanced status", () => {
    expect(leastAdvancedStatus(["in_transit", "waiting_pickup", "delivered"])).toBe("waiting_pickup");
    expect(leastAdvancedStatus(["delivered", "closed"])).toBe("delivered");
    expect(leastAdvancedStatus(["created"])).toBe("created");
  });
});
