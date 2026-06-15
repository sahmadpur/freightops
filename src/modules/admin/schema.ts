import { z } from "zod";
import { userRoleEnum } from "@/db/schema";

export const inviteSchema = z
  .object({
    email: z.string().trim().email(),
    role: z.enum(userRoleEnum.enumValues),
    accountId: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.role !== "client" || !!v.accountId, {
    message: "Client invitations require an account",
    path: ["accountId"],
  });
export type InviteInput = z.infer<typeof inviteSchema>;

export const roleSchema = z.object({ role: z.enum(userRoleEnum.enumValues) });
