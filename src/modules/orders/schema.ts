import { z } from "zod";
import {
  orderStatusEnum,
  incotermsEnum,
  deliveryFormatEnum,
  modeTypeEnum,
  financeCategoryEnum,
} from "@/db/schema";
import { countryCode, intString, numericString, optEnum, optText } from "@/lib/validation";
import { ORDER_CURRENCIES } from "@/lib/fx";

/** One agent-expense row from the create form; seeds a cost finance line. */
export const orderCostLineSchema = z.object({
  category: z.enum(financeCategoryEnum.enumValues),
  amount: numericString,
  note: optText(300),
});

export const orderInputSchema = z.object({
  transportType: optEnum(modeTypeEnum.enumValues),
  accountId: z.string().trim().min(1),
  carrierId: optText(100),
  fromCountry: countryCode,
  toCountry: countryCode,
  /** The order's subject line — "Sifariş mövzusu". */
  title: z.string().trim().min(1).max(300),
  rollbackNumber: optText(100),
  deliveryFormat: optEnum(deliveryFormatEnum.enumValues),
  cargoItems: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  packages: intString,
  weightKg: numericString,
  volumeM3: numericString,
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
});

export type OrderInput = z.infer<typeof orderInputSchema>;
export type OrderCostLineInput = z.infer<typeof orderCostLineSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(orderStatusEnum.enumValues),
});
