import { z } from "zod";
import { orderStatusEnum, incotermsEnum, deliveryFormatEnum } from "@/db/schema";
import { numericString, dateString, transportModeInputSchema } from "@/modules/transport/schema";

const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().or(z.literal(""));

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Transport sub-flow: none, attach existing, or create new (reuses transport schema).
 *  The "new" branch spreads transportModeInputSchema.shape so it stays a plain
 *  ZodObject — discriminatedUnion members must be objects, not intersections. */
const transportSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("existing"), transportModeId: z.string().trim().min(1) }),
  z.object({ mode: z.literal("new"), ...transportModeInputSchema.shape }),
]);

export const orderInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  clientOrderId: optText(100),
  accountId: z.string().trim().min(1),
  carrierId: optText(100),
  route: optText(300),
  cargoDescription: optText(1000),
  packages: z
    .string()
    .trim()
    .regex(/^\d+$/, "Must be a whole number")
    .optional()
    .or(z.literal("")),
  weightKg: numericString,
  volumeM3: numericString,
  incoterms: optEnum(incotermsEnum.enumValues),
  deliveryFormat: optEnum(deliveryFormatEnum.enumValues),
  clientCharge: numericString,
  carrierCost: numericString,
  additionalCosts: numericString,
  additionalCostsNote: optText(1000),
  expectedProfit: numericString,
  invoiceNumber: optText(100),
  invoiceDate: dateString,
  transport: transportSchema,
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(orderStatusEnum.enumValues),
});
