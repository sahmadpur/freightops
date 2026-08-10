import { describe, expect, it } from "vitest";
import { formatDateTime, fromLocalInput, toLocalInput } from "./datetime";

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

describe("datetime-local round trip", () => {
  it("reads an instant as desk time, not browser time", () => {
    // 05:42 UTC is 09:42 in Baku (UTC+4).
    expect(toLocalInput("2026-08-07T05:42:00Z")).toBe("2026-08-07T09:42");
  });

  it("interprets what was typed as desk time", () => {
    expect(fromLocalInput("2026-08-07T09:42")).toBe("2026-08-07T05:42:00.000Z");
  });

  it("round-trips both ways", () => {
    const iso = "2026-01-15T20:05:00.000Z";
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    const local = "2026-12-31T23:59";
    expect(toLocalInput(fromLocalInput(local))).toBe(local);
  });

  it("crosses the date boundary correctly", () => {
    // 00:30 Baku on the 8th is 20:30 UTC on the 7th.
    expect(fromLocalInput("2026-08-08T00:30")).toBe("2026-08-07T20:30:00.000Z");
    expect(toLocalInput("2026-08-07T20:30:00Z")).toBe("2026-08-08T00:30");
  });

  it("returns empty for an unusable value rather than an Invalid Date", () => {
    expect(fromLocalInput("")).toBe("");
    expect(fromLocalInput("not a date")).toBe("");
  });
});
