"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { createUserWithPassword } from "@/lib/create-user";
import { invitationStatus } from "@/lib/invitations";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
});

export async function acceptInvitation(
  input: z.infer<typeof schema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { token, name, password } = parsed.data;

  const inv = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });
  if (!inv) return { ok: false, error: "Invitation not found" };
  const state = invitationStatus(inv);
  if (state !== "valid") {
    return { ok: false, error: state === "used" ? "Invitation already used" : "Invitation expired" };
  }

  try {
    await createUserWithPassword({
      email: inv.email,
      password,
      name,
      role: inv.role,
      accountId: inv.accountId,
    });
  } catch {
    return { ok: false, error: "Could not create the account. It may already exist." };
  }

  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, inv.id));
  return { ok: true };
}
