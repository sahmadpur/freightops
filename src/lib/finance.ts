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

/** Derived status from invoiced + paid cents. Null when nothing is invoiced. */
export function paymentStatus(invoicedCents: number, paidCents: number): PaymentStatus | null {
  if (invoicedCents <= 0) return null;
  if (paidCents <= 0) return "not_paid";
  if (paidCents >= invoicedCents) return "paid";
  return "partly_paid";
}
