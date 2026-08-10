import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "./order-status";
import { isClosedRequestStatus, REQUEST_STATUSES, timestampFor } from "./request-status";

describe("REQUEST_STATUSES", () => {
  it("shares no value with the order lifecycle", () => {
    const orders = new Set<string>(ORDER_STATUSES);
    expect(REQUEST_STATUSES.filter((s) => orders.has(s))).toEqual([]);
  });

  it("treats only the decided statuses as closed", () => {
    expect(isClosedRequestStatus("won")).toBe(true);
    expect(isClosedRequestStatus("lost")).toBe(true);
    expect(isClosedRequestStatus("cancelled")).toBe(true);
    expect(isClosedRequestStatus("waiting_client")).toBe(false);
    expect(isClosedRequestStatus("new")).toBe(false);
  });
});

describe("timestampFor", () => {
  it("maps a transition to the KPI timestamp it stamps", () => {
    expect(timestampFor("in_progress")).toBe("workStartedAt");
    expect(timestampFor("quotation")).toBe("quotationStartedAt");
    expect(timestampFor("quotation_sent")).toBe("quotationSentAt");
  });

  it("stamps the shared decision timestamp for every terminal status", () => {
    expect(timestampFor("won")).toBe("decisionAt");
    expect(timestampFor("lost")).toBe("decisionAt");
    expect(timestampFor("cancelled")).toBe("decisionAt");
  });

  it("stamps nothing for statuses that are not a milestone", () => {
    expect(timestampFor("new")).toBeNull();
    expect(timestampFor("waiting_client")).toBeNull();
  });
});
