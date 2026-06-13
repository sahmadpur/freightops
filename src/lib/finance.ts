import { toCents, sumCents } from "./money";

export type PaymentStatus = "paid" | "partly_paid" | "not_paid";

/** actual profit = client charge − carrier cost − additional costs, in cents. */
export function actualProfitCents(
  clientCharge: string | null,
  carrierCost: string | null,
  additionalCosts: string | null,
): number {
  return toCents(clientCharge) - toCents(carrierCost) - toCents(additionalCosts);
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
