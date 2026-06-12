"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { createUserWithPassword } from "@/lib/create-user";
import { invitationStatus } from "@/lib/invitations";

const schema = z.object({
  token: z.string().min(43).max(64), // base64url of 32 random bytes is 43 chars
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

  // Atomically claim the invitation — closes the double-acceptance race.
  const claimed = await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(and(eq(invitations.id, inv.id), isNull(invitations.acceptedAt)))
    .returning({ id: invitations.id });
  if (claimed.length === 0) return { ok: false, error: "Invitation already used" };

  try {
    await createUserWithPassword({
      email: inv.email,
      password,
      name,
      role: inv.role,
      accountId: inv.accountId,
    });
  } catch (err) {
    console.error("[acceptInvitation] createUserWithPassword failed:", err);
    // Release the claim so the invitee can retry after a transient failure.
    await db.update(invitations).set({ acceptedAt: null }).where(eq(invitations.id, inv.id));
    return { ok: false, error: "Could not create the account. It may already exist." };
  }
  return { ok: true };
}
