import { describe, expect, it } from "vitest";
import { formatDocNumber } from "./doc-number";

describe("formatDocNumber", () => {
  it("prefixes by kind and zero-pads the sequence to 3 digits", () => {
    expect(formatDocNumber("invoice", 2026, 1)).toBe("INV-2026-001");
    expect(formatDocNumber("act", 2026, 41)).toBe("ACT-2026-041");
  });
  it("does not truncate sequences beyond 999", () => {
    expect(formatDocNumber("invoice", 2026, 1234)).toBe("INV-2026-1234");
  });
});
