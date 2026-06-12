"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { carriers, contacts } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { carrierInputSchema, type ActionResult } from "./schema";

const AUDITED_FIELDS = ["title", "address", "notes"];

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

    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "carrier" as const,
          parentId: row.id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

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

    const beforeContacts = await tx
      .select({ name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.parentType, "carrier"), eq(contacts.parentId, id)))
      .orderBy(contacts.createdAt);

    const after = {
      title: data.title,
      address: data.address || null,
      notes: data.notes || null,
    };
    await tx.update(carriers).set(after).where(eq(carriers.id, id));

    // Contacts: replace-all strategy (simple and audit-friendly for v1).
    // Contact ids regenerate on every update — fine while nothing references them
    // (Phase 4 notifications re-read contact emails at send time).
    await tx.delete(contacts).where(and(eq(contacts.parentType, "carrier"), eq(contacts.parentId, id)));
    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "carrier" as const,
          parentId: id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

    const changes = auditDiff(before, after, AUDITED_FIELDS);
    const oldNames = beforeContacts.map((c) => c.name).join(", ") || null;
    const newNames = data.contacts.map((c) => c.name).join(", ") || null;
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
