import { describe, expect, it } from "vitest";
import {
  agingBucket,
  balance,
  bucketAging,
  daysOutstanding,
  expectedProfitCents,
  paymentStatus,
  settledProfitCents,
} from "./finance";

describe("expectedProfitCents", () => {
  it("is client charge minus carrier cost", () => {
    expect(expectedProfitCents("4200", "2800")).toBe(140000);
    expect(expectedProfitCents("4200.00", "2900.00")).toBe(130000);
  });
  it("treats null fields as 0", () => {
    expect(expectedProfitCents("4200", null)).toBe(420000);
    expect(expectedProfitCents(null, null)).toBe(0);
  });
});

describe("settledProfitCents", () => {
  it("is amount receivable minus amount payable", () => {
    expect(settledProfitCents("4200", "2800")).toBe(140000);
    expect(settledProfitCents("4200", null)).toBe(420000);
    expect(settledProfitCents(null, null)).toBe(0);
  });
});

describe("balance", () => {
  it("returns invoiced, paid, and delta in cents", () => {
    expect(balance("4200", ["2000"])).toEqual({ invoicedCents: 420000, paidCents: 200000, deltaCents: 220000 });
  });
  it("delta is negative when overpaid", () => {
    expect(balance("100", ["150"]).deltaCents).toBe(-5000);
  });
  it("handles no invoice amount and no payments", () => {
    expect(balance(null, [])).toEqual({ invoicedCents: 0, paidCents: 0, deltaCents: 0 });
  });
});

describe("agingBucket", () => {
  it("splits at 30 / 60 / 90 days", () => {
    expect(agingBucket(0)).toBe("0-30");
    expect(agingBucket(30)).toBe("0-30");
    expect(agingBucket(31)).toBe("31-60");
    expect(agingBucket(60)).toBe("31-60");
    expect(agingBucket(61)).toBe("61-90");
    expect(agingBucket(90)).toBe("61-90");
    expect(agingBucket(91)).toBe("90+");
  });
});

describe("daysOutstanding", () => {
  const now = new Date("2026-08-05T12:00:00Z");
  it("counts whole days elapsed", () => {
    expect(daysOutstanding(new Date("2026-08-05T00:00:00Z"), now)).toBe(0);
    expect(daysOutstanding(new Date("2026-07-06T12:00:00Z"), now)).toBe(30);
  });
  it("is never negative for a future date", () => {
    expect(daysOutstanding(new Date("2026-09-01T00:00:00Z"), now)).toBe(0);
  });
});

describe("bucketAging", () => {
  const now = new Date("2026-08-05T00:00:00Z");
  const day = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("sums outstanding balances per bucket", () => {
    const result = bucketAging(
      [
        { deltaCents: 10000, since: day(5) },
        { deltaCents: 20000, since: day(45) },
        { deltaCents: 30000, since: day(120) },
        { deltaCents: 5000, since: day(120) },
      ],
      now,
    );
    expect(result.totalCents).toBe(65000);
    expect(result.buckets).toEqual([
      { bucket: "0-30", cents: 10000, count: 1 },
      { bucket: "31-60", cents: 20000, count: 1 },
      { bucket: "61-90", cents: 0, count: 0 },
      { bucket: "90+", cents: 35000, count: 2 },
    ]);
  });

  it("ignores settled and overpaid rows", () => {
    const result = bucketAging(
      [
        { deltaCents: 0, since: day(200) },
        { deltaCents: -5000, since: day(200) },
      ],
      now,
    );
    expect(result.totalCents).toBe(0);
    expect(result.buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("paymentStatus", () => {
  it("is null when no amount is invoiced", () => {
    expect(paymentStatus(0, 0)).toBeNull();
  });
  it("is not_paid when nothing is paid", () => {
    expect(paymentStatus(420000, 0)).toBe("not_paid");
  });
  it("is partly_paid when partially paid", () => {
    expect(paymentStatus(420000, 200000)).toBe("partly_paid");
  });
  it("is paid when fully or over paid", () => {
    expect(paymentStatus(420000, 420000)).toBe("paid");
    expect(paymentStatus(420000, 500000)).toBe("paid");
  });
});
