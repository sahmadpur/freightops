import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import type { Role } from "@/lib/roles";
import { enqueueNotification } from "@/modules/notifications/enqueue";
import { invitationEmail } from "@/modules/notifications/templates";

export const INVITATION_TTL_DAYS = 7;

export type InvitationCheck = { expiresAt: Date; acceptedAt: Date | null };
export type InvitationState = "valid" | "expired" | "used";

export function invitationStatus(inv: InvitationCheck): InvitationState {
  if (inv.acceptedAt) return "used";
  if (inv.expiresAt.getTime() < Date.now()) return "expired";
  return "valid";
}

// SECURITY: caller must verify the session has staff/admin role before calling this.
// Do NOT expose via a "use server" action without a requireArea(...) guard.
export async function createInvitation(params: {
  email: string;
  role: Role;
  accountId?: string;
  invitedBy: string;
}): Promise<{ token: string; url: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const url = `${process.env.APP_BASE_URL}/accept-invitation?token=${token}`;
  await db.transaction(async (tx) => {
    await tx.insert(invitations).values({
      email: params.email,
      role: params.role,
      accountId: params.accountId ?? null,
      token,
      expiresAt,
      invitedBy: params.invitedBy,
    });
    const content = invitationEmail({ url, role: params.role });
    await enqueueNotification(tx, {
      toEmail: params.email,
      subject: content.subject,
      body: content.body,
      relatedType: "invitation",
    });
  });
  return { token, url };
}
