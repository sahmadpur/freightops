import { z } from "zod";
import { isCountryCode } from "./countries";

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

/** Optional trimmed text capped at `max` characters, or empty. */
export const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Optional whole number as a string, or empty. */
export const intString = z
  .string()
  .trim()
  .regex(/^\d+$/, "Must be a whole number")
  .optional()
  .or(z.literal(""));

/** Optional ISO 3166-1 alpha-2, or empty. Guarded so free text can't reach the column. */
export const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || isCountryCode(v), "Unknown country")
  .optional()
  .or(z.literal(""));

/** Optional enum value, or empty. Every form field arrives as a string. */
export const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().or(z.literal(""));
