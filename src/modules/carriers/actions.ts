"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { carriers, orders } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { syncContacts } from "@/modules/accounts/sync-contacts";
import { carrierInputSchema, type ActionResult } from "./schema";

const AUDITED_FIELDS = ["title", "address", "notes"];

/** Soft-delete (archive) a carrier. Blocked while it has non-archived orders. */
export async function archiveCarrier(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const row = await tx.query.carriers.findFirst({ where: eq(carriers.id, id) });
    if (!row) return "not_found" as const;
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.carrierId, id), isNull(orders.deletedAt)));
    if (n > 0) return "has_orders" as const;
    await tx.update(carriers).set({ deletedAt: new Date() }).where(eq(carriers.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "carrier", entityId: id, action: "archived" });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "has_orders") return { ok: false, error: "has_orders" };
  return { ok: true, id };
}

/** Restore a previously archived carrier. */
export async function restoreCarrier(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  await db.transaction(async (tx) => {
    await tx.update(carriers).set({ deletedAt: null }).where(eq(carriers.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "carrier", entityId: id, action: "restored" });
  });
  return { ok: true, id };
}

export async function createCarrier(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = carrierInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(carriers)
      .values({
        title: data.title,
        address: data.address || null,
        notes: data.notes || null,
        createdBy: session.user.id,
      })
      .returning({ id: carriers.id });

    await syncContacts(tx, "carrier", row.id, data.contacts);

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "carrier",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function updateCarrier(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = carrierInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.carriers.findFirst({ where: eq(carriers.id, id) });
    if (!before) return "not_found" as const;

    const after = {
      title: data.title,
      address: data.address || null,
      notes: data.notes || null,
    };
    await tx.update(carriers).set(after).where(eq(carriers.id, id));

    const contactNames = await syncContacts(tx, "carrier", id, data.contacts);

    const changes = auditDiff(before, after, AUDITED_FIELDS);
    const oldNames = contactNames.before.join(", ") || null;
    const newNames = contactNames.after.join(", ") || null;
    if (oldNames !== newNames) {
      changes.push({ field: "contacts", oldValue: oldNames, newValue: newNames });
    }
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "carrier",
        entityId: id,
        action: "updated",
        changes,
      });
    }
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}
