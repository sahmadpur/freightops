import { z } from "zod";
import { optText } from "@/lib/validation";
export type { ActionResult } from "@/lib/forms";

/**
 * A manually logged communication — the call summary of §6.3 and the WhatsApp
 * notes of §18, recorded through the same entity an Outlook sync will write to.
 * Keeping one table means the Communication tab shows a single chronology
 * whatever the channel, which is what the desk actually needs.
 */
export const manualMessageSchema = z.object({
  channel: z.enum(["whatsapp", "phone", "other"]),
  direction: z.enum(["incoming", "outgoing"]),
  subject: optText(500),
  body: z.string().trim().min(1).max(10000),
  /** When the call happened, not when it was typed up. Empty means now. */
  occurredAt: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Must be a date/time")
    .optional()
    .or(z.literal("")),
});

export type ManualMessageInput = z.infer<typeof manualMessageSchema>;

/** Attach an existing message to another request — the §17.9 "Link email" action. */
export const linkMessageSchema = z.object({
  messageId: z.string().trim().min(1),
});
