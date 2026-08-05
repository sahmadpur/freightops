import { z } from "zod";
import { customsItemCategoryEnum } from "@/db/schema";
import { dateString, numericString, optText } from "@/lib/validation";
import { ORDER_CURRENCIES } from "@/lib/fx";

/**
 * One cost line. Every category carries both a buy (what we pay) and a sell
 * (what we charge) amount, and nothing on a clearance is mandatory — the desk
 * fills in whichever apply.
 */
export const customsItemSchema = z.object({
  category: z.enum(customsItemCategoryEnum.enumValues),
  buyAmount: numericString,
  sellAmount: numericString,
  note: optText(300),
});

export const customsClearanceInputSchema = z
  .object({
    /** Attach to an existing order, or stand alone against a client. */
    orderId: optText(100),
    accountId: optText(100),
    declarationNumber: optText(100),
    description: optText(500),
    currency: z.enum(ORDER_CURRENCIES),
    exchangeRate: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,4})?$/, "Must be a number")
      .optional()
      .or(z.literal("")),
    clearedAt: dateString,
    notes: optText(1000),
    items: z.array(customsItemSchema).max(50).default([]),
  })
  .refine((v) => Boolean(v.orderId) || Boolean(v.accountId), {
    message: "Pick an order or a client",
    path: ["accountId"],
  });

export type CustomsClearanceInput = z.infer<typeof customsClearanceInputSchema>;
export type CustomsItemInput = z.infer<typeof customsItemSchema>;
