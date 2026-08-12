"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, orders } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { accountInputSchema, type ActionResult } from "./schema";
import { syncContacts } from "./sync-contacts";

const AUDITED_FIELDS = ["title", "taxId", "address", "country", "city", "notes"];

/** Soft-delete (archive) an account. Blocked while it has non-archived orders. */
export async function archiveAccount(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const row = await tx.query.accounts.findFirst({ where: eq(accounts.id, id) });
    if (!row) return "not_found" as const;
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.accountId, id), isNull(orders.deletedAt)));
    if (n > 0) return "has_orders" as const;
    await tx.update(accounts).set({ deletedAt: new Date() }).where(eq(accounts.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "account", entityId: id, action: "archived" });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "has_orders") return { ok: false, error: "has_orders" };
  return { ok: true, id };
}

/** Restore a previously archived account. */
export async function restoreAccount(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ deletedAt: null }).where(eq(accounts.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "account", entityId: id, action: "restored" });
  });
  return { ok: true, id };
}

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
        roles: data.roles,
        taxId: data.taxId || null,
        address: data.address || null,
        country: data.country || null,
        city: data.city || null,
        phones: data.phones,
        emailDomains: data.emailDomains,
        notes: data.notes || null,
        createdBy: session.user.id,
      })
      .returning({ id: accounts.id });

    await syncContacts(tx, "account", row.id, data.contacts);

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

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.accounts.findFirst({ where: eq(accounts.id, id) });
    if (!before) return "not_found" as const;

    const after = {
      title: data.title,
      roles: data.roles,
      taxId: data.taxId || null,
      address: data.address || null,
      country: data.country || null,
      city: data.city || null,
      phones: data.phones,
      emailDomains: data.emailDomains,
      notes: data.notes || null,
    };
    await tx.update(accounts).set(after).where(eq(accounts.id, id));

    const contactNames = await syncContacts(tx, "account", id, data.contacts);

    const changes = auditDiff(before, after, AUDITED_FIELDS);
    const oldNames = contactNames.before.join(", ") || null;
    const newNames = contactNames.after.join(", ") || null;
    if (oldNames !== newNames) {
      changes.push({ field: "contacts", oldValue: oldNames, newValue: newNames });
    }
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "account",
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
