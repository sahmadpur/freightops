import { describe, expect, it } from "vitest";
import { formatAnnualNumber, formatRecordNumber } from "./record-number";

describe("formatRecordNumber", () => {
  it("renders the PREFIXYYMMNNN format", () => {
    expect(formatRecordNumber("customs", 2026, 7, 1)).toBe("CC2607001");
  });

  it("zero-pads year, month and sequence", () => {
    expect(formatRecordNumber("customs", 2026, 1, 5)).toBe("CC2601005");
    expect(formatRecordNumber("customs", 2009, 12, 41)).toBe("CC0912041");
  });

  it("restarts the sequence each month", () => {
    expect(formatRecordNumber("customs", 2026, 7, 2)).toBe("CC2607002");
    expect(formatRecordNumber("customs", 2026, 8, 1)).toBe("CC2608001");
  });

  it("does not truncate sequences beyond 999", () => {
    expect(formatRecordNumber("customs", 2026, 7, 1000)).toBe("CC26071000");
  });

  it("wraps the year at the century boundary", () => {
    expect(formatRecordNumber("customs", 2100, 3, 7)).toBe("CC0003007");
  });
});

describe("formatAnnualNumber", () => {
  it("renders the specification's PREFIX-YYYY-NNNN format", () => {
    expect(formatAnnualNumber("request", 2026, 145)).toBe("REQ-2026-0145");
    expect(formatAnnualNumber("order", 2026, 87)).toBe("ORD-2026-0087");
  });

  it("zero-pads the sequence to four digits", () => {
    expect(formatAnnualNumber("request", 2026, 1)).toBe("REQ-2026-0001");
  });

  it("does not truncate sequences beyond 9999", () => {
    expect(formatAnnualNumber("request", 2026, 10000)).toBe("REQ-2026-10000");
  });

  it("keeps the full year, so the sequence can restart each January", () => {
    expect(formatAnnualNumber("order", 2027, 1)).toBe("ORD-2027-0001");
  });
});
