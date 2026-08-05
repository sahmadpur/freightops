import { describe, expect, it } from "vitest";
import { formatRecordNumber } from "./record-number";

describe("formatRecordNumber", () => {
  it("renders the client's ALLYYMMNNN format", () => {
    expect(formatRecordNumber("order", 2026, 7, 1)).toBe("ALL2607001");
  });

  it("zero-pads year, month and sequence", () => {
    expect(formatRecordNumber("order", 2026, 1, 5)).toBe("ALL2601005");
    expect(formatRecordNumber("order", 2009, 12, 41)).toBe("ALL0912041");
  });

  it("restarts the sequence each month", () => {
    expect(formatRecordNumber("order", 2026, 7, 2)).toBe("ALL2607002");
    expect(formatRecordNumber("order", 2026, 8, 1)).toBe("ALL2608001");
  });

  it("does not truncate sequences beyond 999", () => {
    expect(formatRecordNumber("order", 2026, 7, 1000)).toBe("ALL26071000");
  });

  it("wraps the year at the century boundary", () => {
    expect(formatRecordNumber("order", 2100, 3, 7)).toBe("ALL0003007");
  });

  it("uses a distinct prefix per record kind", () => {
    expect(formatRecordNumber("customs", 2026, 7, 1)).toBe("CC2607001");
  });
});
