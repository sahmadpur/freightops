import { z } from "zod";

/** Checkbox/string → boolean ("true" or "on" → true, everything else → false). */
const checkboxBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true" || v === "on");

export const generateDocInputSchema = z
  .object({
    orderId: z.string().trim().min(1),
    kind: z.enum(["invoice", "act"]),
    language: z.enum(["en", "ru", "az"]),
    numberMode: z.enum(["auto", "manual"]),
    number: z.string().trim().max(50).optional().or(z.literal("")),
    // Required (unlike the shared optional dateString): it becomes the document
    // date and picks the sequence year.
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date"),
    visibleToClient: checkboxBool,
  })
  .refine((v) => v.numberMode === "auto" || (v.number ?? "").length > 0, {
    path: ["number"],
    message: "Number is required",
  });

export type GenerateDocInput = z.infer<typeof generateDocInputSchema>;
