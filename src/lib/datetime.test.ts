import { describe, expect, it } from "vitest";
import { formatDateTime } from "./datetime";

// 2026-08-05 08:34 UTC is 12:34 in Baku — the fixed zone must be applied
// regardless of the machine running the test.
const AT = new Date("2026-08-05T08:34:00Z");

describe("formatDateTime", () => {
  it("writes Azerbaijani months from our own table, not the browser's", () => {
    expect(formatDateTime(AT, "az")).toBe("5 avq 2026, 12:34");
    expect(formatDateTime(AT, "az", "short")).toBe("05.08.26, 12:34");
  });

  it("reads timestamps in Baku time, whatever the host zone", () => {
    expect(formatDateTime(AT, "az")).toContain("12:34");
    expect(formatDateTime(AT, "en")).toContain("12:34");
  });

  it("accepts strings and epoch millis", () => {
    expect(formatDateTime("2026-08-05T08:34:00Z", "az")).toBe("5 avq 2026, 12:34");
    expect(formatDateTime(AT.getTime(), "az")).toBe("5 avq 2026, 12:34");
  });

  it("leaves other locales to Intl", () => {
    expect(formatDateTime(AT, "en")).toBe("Aug 5, 2026, 12:34 PM");
    expect(formatDateTime(AT, "ru")).toContain("2026");
  });
});
