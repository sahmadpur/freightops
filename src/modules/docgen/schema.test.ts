import { describe, expect, it } from "vitest";
import { generateDocInputSchema } from "./schema";

const base = {
  orderId: "o1",
  kind: "invoice",
  language: "ru",
  numberMode: "auto",
  date: "2026-07-02",
  visibleToClient: "on",
};

describe("generateDocInputSchema", () => {
  it("accepts auto mode without a number", () => {
    const parsed = generateDocInputSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.visibleToClient).toBe(true);
  });
  it("requires a number in manual mode", () => {
    expect(generateDocInputSchema.safeParse({ ...base, numberMode: "manual" }).success).toBe(false);
    expect(
      generateDocInputSchema.safeParse({ ...base, numberMode: "manual", number: "INV-X-1" })
        .success,
    ).toBe(true);
  });
  it("rejects a malformed date", () => {
    expect(generateDocInputSchema.safeParse({ ...base, date: "02.07.2026" }).success).toBe(false);
  });
  it("rejects unknown kinds and languages", () => {
    expect(generateDocInputSchema.safeParse({ ...base, kind: "waybill" }).success).toBe(false);
    expect(generateDocInputSchema.safeParse({ ...base, language: "de" }).success).toBe(false);
  });
});
