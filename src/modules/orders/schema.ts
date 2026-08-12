import { z } from "zod";
import { orderStatusEnum, incotermsEnum, financeCategoryEnum, transportFamilyEnum } from "@/db/schema";
import { numericString, optEnum, optText } from "@/lib/validation";
import { ORDER_CURRENCIES } from "@/lib/fx";
import {
  cargoInputSchema,
  legInputSchema,
  refineShipment,
} from "@/modules/requests/schema";

/** One agent-expense row from the create form; seeds a cost finance line. */
export const orderCostLineSchema = z.object({
  category: z.enum(financeCategoryEnum.enumValues),
  amount: numericString,
  note: optText(300),
});

export const orderInputSchema = z.object({
  accountId: z.string().trim().min(1),
  carrierId: optText(100),
  /** The order's subject line — "Sifariş mövzusu". */
  title: z.string().trim().min(1).max(300),
  rollbackNumber: optText(100),
  /**
   * Route, transport and cargo are the same structured shipment a request
   * carries (§26); the flat `orders` columns are derived from it by
   * `shipmentColumns`, never submitted.
   */
  transportFamily: optEnum(transportFamilyEnum.enumValues),
  legs: z.array(legInputSchema).max(20).default([]),
  cargo: cargoInputSchema,
  incoterms: optEnum(incotermsEnum.enumValues),
  currency: z.enum(ORDER_CURRENCIES),
  // FX rate: AZN per 1 unit of `currency`; up to 4 decimals.
  exchangeRate: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, "Must be a number")
    .optional()
    .or(z.literal("")),
  // Quick-entry total used ONLY on create to seed the first revenue line;
  // thereafter clientCharge is a rollup maintained by finance-line edits.
  clientCharge: numericString,
  // Agent expenses. Create-only for the same reason; edits go through the
  // Finance tab so the rollup and the lines can never drift.
  costLines: z.array(orderCostLineSchema).max(50).default([]),
}).superRefine(refineShipment);

export type OrderInput = z.infer<typeof orderInputSchema>;
export type OrderCostLineInput = z.infer<typeof orderCostLineSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(orderStatusEnum.enumValues),
});
