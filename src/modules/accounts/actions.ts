"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, contacts } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { accountInputSchema, type ActionResult } from "./schema";

const AUDITED_FIELDS = ["title", "taxId", "address", "notes"];

export async function createAccount(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(accounts)
      .values({
        title: data.title,
        taxId: data.taxId || null,
        address: data.address || null,
        notes: data.notes || null,
        createdBy: session.user.id,
      })
      .returning({ id: accounts.id });

    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "account" as const,
          parentId: row.id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "account",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function updateAccount(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const before = await db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (!before) return { ok: false, error: "not_found" };

  await db.transaction(async (tx) => {
    const after = {
      title: data.title,
      taxId: data.taxId || null,
      address: data.address || null,
      notes: data.notes || null,
    };
    await tx.update(accounts).set(after).where(eq(accounts.id, id));

    // Contacts: replace-all strategy (simple and audit-friendly for v1)
    await tx.delete(contacts).where(and(eq(contacts.parentType, "account"), eq(contacts.parentId, id)));
    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "account" as const,
          parentId: id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

    const changes = auditDiff(before, after, AUDITED_FIELDS);
    changes.push({
      field: "contacts",
      oldValue: null,
      newValue: data.contacts.map((c) => c.name).join(", ") || null,
    });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "account",
      entityId: id,
      action: "updated",
      changes,
    });
  });

  return { ok: true, id };
}
