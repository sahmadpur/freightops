import { z } from "zod";

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
