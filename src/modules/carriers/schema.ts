import { z } from "zod";
import { contactInputSchema } from "@/modules/accounts/schema";

export { contactInputSchema };
export type { ActionResult } from "@/lib/forms";

export const carrierInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  contacts: z.array(contactInputSchema).max(20),
});

export type CarrierInput = z.infer<typeof carrierInputSchema>;
