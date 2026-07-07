import { describe, expect, it } from "vitest";
import { formatDocNumber } from "./doc-number";

describe("formatDocNumber", () => {
  it("formats an invoice as RL-DDMMYY + 3-digit sequence", () => {
    expect(formatDocNumber("invoice", "2026-03-27", 4)).toBe("RL-270326004");
    expect(formatDocNumber("invoice", "2026-01-01", 1)).toBe("RL-010126001");
  });
  it("formats an ACT as 'AKT № NN' (2-digit sequence)", () => {
    expect(formatDocNumber("act", "2026-03-27", 1)).toBe("AKT № 01");
    expect(formatDocNumber("act", "2026-03-27", 41)).toBe("AKT № 41");
  });
  it("does not truncate sequences beyond their pad width", () => {
    expect(formatDocNumber("invoice", "2026-03-27", 1234)).toBe("RL-2703261234");
    expect(formatDocNumber("act", "2026-03-27", 100)).toBe("AKT № 100");
  });
});
