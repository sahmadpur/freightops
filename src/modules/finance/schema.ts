import { z } from "zod";
import { financeCategoryEnum, financeLineSideEnum, paymentDirectionEnum } from "@/db/schema";
import { dateString, numericString, optText } from "@/lib/validation";

/** A money amount that must be present and strictly positive (for payments). */
const positiveAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a number")
  .refine((s) => Number(s) > 0, "Must be greater than zero");

export const paymentInputSchema = z.object({
  direction: z.enum(paymentDirectionEnum.enumValues),
  amount: positiveAmount,
  paidAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

/**
 * Order receivable/payable invoice amounts (optional, clearable), plus the
 * carrier's received invoice — recorded here rather than on the order form,
 * which no longer carries any invoice fields.
 */
export const financialsInputSchema = z.object({
  amountReceivable: numericString,
  amountPayable: numericString,
  carrierInvoiceNumber: optText(100),
  carrierInvoiceDate: dateString,
});

export type FinancialsInput = z.infer<typeof financialsInputSchema>;

/** A revenue/cost line item (description + positive amount + optional note). */
export const financeLineInputSchema = z.object({
  side: z.enum(financeLineSideEnum.enumValues),
  /** Agent-expense category; meaningful for cost lines, "other" for revenue. */
  category: z.enum(financeCategoryEnum.enumValues).default("other"),
  description: z.string().trim().min(1).max(300),
  amount: positiveAmount,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type FinanceLineInput = z.infer<typeof financeLineInputSchema>;
