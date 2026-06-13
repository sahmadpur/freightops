import { describe, expect, it } from "vitest";
import { formatOrderNumber } from "./order-number";

describe("formatOrderNumber", () => {
  it("zero-pads the sequence to 3 digits", () => {
    expect(formatOrderNumber(2026, 1)).toBe("ORD-2026-001");
    expect(formatOrderNumber(2026, 41)).toBe("ORD-2026-041");
  });
  it("does not truncate sequences beyond 999", () => {
    expect(formatOrderNumber(2026, 1234)).toBe("ORD-2026-1234");
  });
});
