import { z } from "zod";
import { COMPANY_ROLES } from "@/lib/company-roles";
import { countryCode } from "@/lib/validation";
export type { ActionResult } from "@/lib/forms";

/** Drops whitespace-only entries, trims the rest. Absent reads as empty. */
const trimmedList = (max: number, validate?: (s: z.ZodString) => z.ZodString) =>
  z
    .array(z.string())
    .max(max)
    .transform((arr) => arr.map((s) => s.trim()).filter((s) => s.length > 0))
    .pipe(z.array(validate ? validate(z.string()) : z.string().max(100)).max(max))
    .default([]);

export const contactInputSchema = z.object({
  /** Present when editing an existing contact; absent for a newly added row. */
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(200),
  position: z.string().trim().max(200).optional().or(z.literal("")),
  phones: trimmedList(10, (s) => s.min(3).max(30)),
  emails: trimmedList(10, (s) => s.email().max(200)),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  preferredChannel: z.enum(["email", "phone", "whatsapp", "other"]).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

/** "bosch.com" — no scheme, no "@", lower-cased. */
const emailDomain = (s: z.ZodString) =>
  s
    .max(253)
    .toLowerCase()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Not a domain");

export const accountInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  /** Which hats the company wears; at least one. */
  roles: z.array(z.enum(COMPANY_ROLES)).min(1).default(["client"]),
  taxId: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  country: countryCode,
  city: z.string().trim().max(200).optional().or(z.literal("")),
  phones: trimmedList(10, (s) => s.min(3).max(30)),
  emailDomains: trimmedList(10, emailDomain),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  contacts: z.array(contactInputSchema).max(20),
});

export type AccountInput = z.infer<typeof accountInputSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
