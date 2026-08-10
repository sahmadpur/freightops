import { describe, expect, it } from "vitest";
import { formatHours, formatPercent } from "./duration";

describe("formatHours", () => {
  it("uses minutes below an hour — registration time is usually minutes", () => {
    expect(formatHours(0.63)).toBe("38 min");
    expect(formatHours(0.0166)).toBe("1 min");
  });

  it("uses hours up to two days", () => {
    expect(formatHours(1)).toBe("1.0 h");
    expect(formatHours(5.25)).toBe("5.3 h");
    expect(formatHours(47.9)).toBe("47.9 h");
  });

  it("switches to days beyond that, where hours stop being readable", () => {
    expect(formatHours(48)).toBe("2.0 d");
    expect(formatHours(120)).toBe("5.0 d");
  });

  it("renders an em-dash when there is nothing to measure", () => {
    expect(formatHours(null)).toBe("—");
    expect(formatHours(Number.NaN)).toBe("—");
    expect(formatHours(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("survives a negative span rather than mislabelling its unit", () => {
    // A back-dated correction can produce one; it should read as negative, not tiny.
    expect(formatHours(-3)).toBe("-3.0 h");
    expect(formatHours(-0.5)).toBe("-30 min");
  });
});

describe("formatPercent", () => {
  it("formats a rate to one decimal by default", () => {
    expect(formatPercent(12.96)).toBe("13.0%");
    expect(formatPercent(100)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("renders an em-dash when the denominator was zero", () => {
    expect(formatPercent(null)).toBe("—");
  });
});
