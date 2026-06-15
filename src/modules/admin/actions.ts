"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { user, invitations } from "@/db/schema";
import { requireArea } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/forms";
import { createInvitation } from "@/lib/invitations";
import { selfMutationBlocked } from "@/lib/user-guard";
import { inviteSchema, roleSchema } from "./schema";

export async function inviteUser(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const existing = await db.query.user.findFirst({ where: eq(user.email, data.email) });
  if (existing) return { ok: false, error: "user_exists" };

  await createInvitation({
    email: data.email,
    role: data.role,
    accountId: data.accountId,
    invitedBy: session.user.id,
  });
  return { ok: true, id: "" };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  if (selfMutationBlocked(session.user.id, userId, { active })) return { ok: false, error: "self_lockout" };

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.user.findFirst({ where: eq(user.id, userId) });
    if (!before) return "not_found" as const;
    if (before.active === active) return "ok" as const;
    await tx.update(user).set({ active }).where(eq(user.id, userId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "user",
      entityId: userId,
      action: active ? "user_activated" : "user_deactivated",
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: "" };
}

export async function setUserRole(userId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_role" };
  const { role } = parsed.data;
  if (selfMutationBlocked(session.user.id, userId, { role })) return { ok: false, error: "self_lockout" };

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.user.findFirst({ where: eq(user.id, userId) });
    if (!before) return "not_found" as const;
    if (before.role === role) return "ok" as const;
    await tx.update(user).set({ role }).where(eq(user.id, userId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "user",
      entityId: userId,
      action: "user_role_changed",
      changes: [{ field: "role", oldValue: before.role, newValue: role }],
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: "" };
}

/** Revoke a still-pending (unaccepted) invitation. Accepted invites are kept as history. */
export async function revokeInvitation(id: string): Promise<ActionResult> {
  await requireArea("admin");
  await db.delete(invitations).where(and(eq(invitations.id, id), isNull(invitations.acceptedAt)));
  return { ok: true, id: "" };
}
