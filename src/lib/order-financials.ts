/**
 * The financial rule of specification §16.
 *
 * Price must never block *creating* an order: when a client phones to say
 * "collect it tomorrow", the desk needs the order now and the numbers later.
 * But an order must not be *closed* with the money still unknown, or the
 * shipment leaves no trace in the accounts.
 *
 * So the required set is checked at exactly one gate — closing — and shown as a
 * standing indicator on the order card until it is satisfied.
 */

/** The financial fields an order must carry before it can be closed. */
export const REQUIRED_FINANCIAL_FIELDS = ["clientCharge", "carrierCost"] as const;

export type FinancialFields = {
  /** Σ revenue lines — what the client is billed. */
  clientCharge: string | null;
  /** Σ cost lines — what the carrier and agents cost us. */
  carrierCost: string | null;
};

/**
 * The required fields that are still empty. Empty array means the order may be
 * closed. A recorded zero counts as answered: "this leg cost us nothing" is a
 * fact, unlike a blank.
 */
export function missingFinancials(order: FinancialFields): string[] {
  return REQUIRED_FINANCIAL_FIELDS.filter((field) => {
    const value = order[field];
    return value === null || value.trim() === "";
  });
}

/** True while the §16 "Financial data incomplete" indicator should be shown. */
export function financialDataIncomplete(order: FinancialFields): boolean {
  return missingFinancials(order).length > 0;
}
