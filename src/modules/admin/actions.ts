"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { user, invitations, cargoTypes } from "@/db/schema";
import { requireArea } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/forms";
import { createInvitation } from "@/lib/invitations";
import { selfMutationBlocked } from "@/lib/user-guard";
import { cargoTypeSchema, inviteSchema, roleSchema } from "./schema";

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

// --- Cargo-description dictionary (справочник) --------------------------------

export async function createCargoType(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  const parsed = cargoTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const { title } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(cargoTypes)
      .values({ title })
      .onConflictDoNothing({ target: cargoTypes.title })
      .returning({ id: cargoTypes.id });
    if (!row) return "exists" as const;
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "cargo_type",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });
  if (result === "exists") return { ok: false, error: "exists" };
  return { ok: true, id: result };
}

export async function renameCargoType(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  const parsed = cargoTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const { title } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.cargoTypes.findFirst({ where: eq(cargoTypes.id, id) });
    if (!before) return "not_found" as const;
    if (before.title === title) return "ok" as const;
    await tx.update(cargoTypes).set({ title }).where(eq(cargoTypes.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "cargo_type",
      entityId: id,
      action: "updated",
      changes: [{ field: "title", oldValue: before.title, newValue: title }],
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}

/** Soft delete: existing cargo rows keep the text, the option just stops being offered. */
export async function setCargoTypeArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  await db.transaction(async (tx) => {
    await tx
      .update(cargoTypes)
      .set({ deletedAt: archived ? new Date() : null })
      .where(eq(cargoTypes.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "cargo_type",
      entityId: id,
      action: archived ? "archived" : "restored",
    });
  });
  return { ok: true, id };
}

/** Revoke a still-pending (unaccepted) invitation. Accepted invites are kept as history. */
export async function revokeInvitation(id: string): Promise<ActionResult> {
  await requireArea("admin");
  await db.delete(invitations).where(and(eq(invitations.id, id), isNull(invitations.acceptedAt)));
  return { ok: true, id: "" };
}
