import { z } from "zod";
import { intString, numericString, optText, dateString } from "@/lib/validation";
import { ORDER_CURRENCIES } from "@/lib/fx";
export type { ActionResult } from "@/lib/forms";

/**
 * One commercial offer. Internal cost and client price are fields of the same
 * record on purpose — the specification is explicit that "Pricing" and
 * "Quotation" must never appear as two user-facing stages (§13, Appendix D).
 *
 * Nothing is required: a quotation is worked on over hours, and half of it
 * exists before the carrier answers.
 */
export const quotationInputSchema = z.object({
  currency: z.enum(ORDER_CURRENCIES),
  expectedCostTotal: numericString,
  sellingPrice: numericString,
  validUntil: dateString,
  transitTimeDays: intString,
  terms: optText(5000),
  notes: optText(5000),
});

export type QuotationInput = z.infer<typeof quotationInputSchema>;

/**
 * Expected margin in the quotation's own currency, as a pair of integer-safe
 * strings turned into numbers only for the comparison. Returns null unless both
 * sides are known — a half-filled quotation has no margin, not a margin of zero.
 */
export function expectedMargin(
  sellingPrice: string | null,
  expectedCostTotal: string | null,
): { amount: number; percent: number | null } | null {
  if (!sellingPrice || !expectedCostTotal) return null;
  const sell = Number(sellingPrice);
  const cost = Number(expectedCostTotal);
  if (Number.isNaN(sell) || Number.isNaN(cost)) return null;
  const amount = sell - cost;
  return { amount, percent: sell === 0 ? null : (amount / sell) * 100 };
}
