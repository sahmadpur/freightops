import { z } from "zod";
import { paymentDirectionEnum } from "@/db/schema";
import { numericString } from "@/modules/transport/schema";

/** A money amount that must be present and strictly positive (for payments). */
const positiveAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a number")
  .refine((s) => Number(s) > 0, "Must be greater than zero");

export const paymentInputSchema = z.object({
  direction: z.enum(paymentDirectionEnum.enumValues as unknown as [string, ...string[]]),
  amount: positiveAmount,
  paidAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

/** Order receivable/payable invoice amounts (optional, clearable). */
export const financialsInputSchema = z.object({
  amountReceivable: numericString,
  amountPayable: numericString,
});

export type FinancialsInput = z.infer<typeof financialsInputSchema>;
