import { toCents, sumCents } from "./money";

export type PaymentStatus = "paid" | "partly_paid" | "not_paid";

/**
 * Expected (planned) profit = client charge − carrier cost, in cents. Both are
 * rollups of the order's revenue / cost line items. Previously mislabeled
 * "actual profit"; see requirement #14.
 */
export function expectedProfitCents(clientCharge: string | null, carrierCost: string | null): number {
  return toCents(clientCharge) - toCents(carrierCost);
}

/**
 * Actual (settled) profit = amount receivable − amount payable, in cents — the
 * agreed "Save amounts" figures, per requirement #14.
 */
export function settledProfitCents(
  amountReceivable: string | null,
  amountPayable: string | null,
): number {
  return toCents(amountReceivable) - toCents(amountPayable);
}

/** Invoiced vs paid for one side (receivable or payable). */
export function balance(
  invoiced: string | null,
  payments: (string | null)[],
): { invoicedCents: number; paidCents: number; deltaCents: number } {
  const invoicedCents = toCents(invoiced);
  const paidCents = sumCents(payments);
  return { invoicedCents, paidCents, deltaCents: invoicedCents - paidCents };
}

export const AGING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Whole days elapsed between `since` and `now` (never negative). */
export function daysOutstanding(since: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));
}

/** Which aging bucket an outstanding balance falls into, by age in days. */
export function agingBucket(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/**
 * Sums outstanding balances into the four aging buckets. Rows with nothing
 * outstanding (delta ≤ 0, i.e. settled or overpaid) are ignored, so the total
 * matches the "outstanding balance" figures elsewhere on the page.
 */
export function bucketAging(
  rows: { deltaCents: number; since: Date }[],
  now: Date,
): { buckets: { bucket: AgingBucket; cents: number; count: number }[]; totalCents: number } {
  const sums = new Map<AgingBucket, { cents: number; count: number }>(
    AGING_BUCKETS.map((b) => [b, { cents: 0, count: 0 }]),
  );
  let totalCents = 0;
  for (const row of rows) {
    if (row.deltaCents <= 0) continue;
    const entry = sums.get(agingBucket(daysOutstanding(row.since, now)))!;
    entry.cents += row.deltaCents;
    entry.count += 1;
    totalCents += row.deltaCents;
  }
  return {
    buckets: AGING_BUCKETS.map((bucket) => ({ bucket, ...sums.get(bucket)! })),
    totalCents,
  };
}

/** Derived status from invoiced + paid cents. Null when nothing is invoiced. */
export function paymentStatus(invoicedCents: number, paidCents: number): PaymentStatus | null {
  if (invoicedCents <= 0) return null;
  if (paidCents <= 0) return "not_paid";
  if (paidCents >= invoicedCents) return "paid";
  return "partly_paid";
}
