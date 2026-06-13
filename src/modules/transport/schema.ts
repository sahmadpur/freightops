import { z } from "zod";
import { modeTypeEnum } from "@/db/schema";

/** Optional numeric string: "", absent, or a number with up to 2 decimals. */
export const numericString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a number")
  .optional()
  .or(z.literal(""));

/** Optional ISO date string (yyyy-mm-dd) or empty. */
export const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date")
  .optional()
  .or(z.literal(""));

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const transportModeInputSchema = z.object({
  modeType: z.enum(modeTypeEnum.enumValues),
  number: z.string().trim().min(1).max(100),
  fromCountry: optText(100),
  toCountry: optText(100),
  route: optText(300),
  loadingDate: dateString,
  plannedArrivalDate: dateString,
  totalWeightKg: numericString,
  totalVolumeM3: numericString,
});

export type TransportModeInput = z.infer<typeof transportModeInputSchema>;
