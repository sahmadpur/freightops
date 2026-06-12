import { z } from "zod";

/** Drops whitespace-only entries, trims the rest. */
const trimmedList = (max: number, validate?: (s: z.ZodString) => z.ZodString) =>
  z
    .array(z.string())
    .max(max)
    .transform((arr) => arr.map((s) => s.trim()).filter((s) => s.length > 0))
    .pipe(z.array(validate ? validate(z.string()) : z.string().max(100)).max(max));

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phones: trimmedList(10, (s) => s.min(3).max(30)),
  emails: trimmedList(10, (s) => s.email().max(200)),
});

export const accountInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  taxId: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  contacts: z.array(contactInputSchema).max(20),
});

export type AccountInput = z.infer<typeof accountInputSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;

/** Shared shape for the form's typed result. */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };
