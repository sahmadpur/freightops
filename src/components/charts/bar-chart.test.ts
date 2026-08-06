import { describe, expect, it } from "vitest";
import { axisTicks } from "./bar-chart";

describe("axisTicks", () => {
  it("spans the data and always includes zero", () => {
    const ticks = axisTicks(0, 940_000);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(940_000);
    expect(ticks).toContain(0);
  });

  it("brackets a loss below the baseline", () => {
    const ticks = axisTicks(-320_000, 480_000);
    expect(ticks[0]).toBeLessThanOrEqual(-320_000);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(480_000);
    expect(ticks).toContain(0);
  });

  it("uses an even step", () => {
    const ticks = axisTicks(0, 1_000_000);
    const steps = ticks.slice(1).map((t, i) => t - ticks[i]);
    expect(new Set(steps).size).toBe(1);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
  });

  it("degenerates safely when every value is the same", () => {
    expect(axisTicks(0, 0)).toEqual([0, 1]);
  });
});
