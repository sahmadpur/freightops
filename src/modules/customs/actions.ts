"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customsClearanceItems, customsClearances, orders } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { nextRecordNumber } from "@/lib/record-number";
import { requireArea } from "@/lib/session";
import { customsClearanceInputSchema, type CustomsClearanceInput } from "./schema";
import type { ActionResult } from "@/lib/forms";

const AUDITED_FIELDS = [
  "orderId",
  "accountId",
  "declarationNumber",
  "description",
  "currency",
  "exchangeRate",
  "clearedAt",
  "notes",
];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toRow(data: CustomsClearanceInput) {
  return {
    orderId: data.orderId || null,
    accountId: data.accountId || null,
    declarationNumber: data.declarationNumber || null,
    description: data.description || null,
    currency: data.currency,
    exchangeRate: data.exchangeRate || null,
    clearedAt: data.clearedAt || null,
    notes: data.notes || null,
  };
}

/**
 * Replace a clearance's item list wholesale. The form always submits the full
 * list, and items carry no identity of their own worth preserving, so a
 * delete-then-insert inside the transaction is simpler than diffing.
 */
async function writeItems(tx: Tx, clearanceId: string, data: CustomsClearanceInput) {
  await tx.delete(customsClearanceItems).where(eq(customsClearanceItems.clearanceId, clearanceId));
  const rows = data.items
    .filter((i) => i.buyAmount || i.sellAmount || i.note)
    .map((i, sortOrder) => ({
      clearanceId,
      category: i.category,
      buyAmount: i.buyAmount || null,
      sellAmount: i.sellAmount || null,
      note: i.note || null,
      sortOrder,
    }));
  if (rows.length) await tx.insert(customsClearanceItems).values(rows);
}

export async function createCustomsClearance(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = customsClearanceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    // When attached to an order, inherit its client so the clearance is always
    // billable to someone even if the form left the client blank.
    let accountId = data.accountId || null;
    if (data.orderId) {
      const order = await tx.query.orders.findFirst({ where: eq(orders.id, data.orderId) });
      if (!order) return "order_not_found" as const;
      accountId = accountId ?? order.accountId;
    }

    const now = new Date();
    const number = await nextRecordNumber(tx, "customs", now.getFullYear(), now.getMonth() + 1);
    const [row] = await tx
      .insert(customsClearances)
      .values({ ...toRow(data), accountId, number, createdBy: session.user.id })
      .returning({ id: customsClearances.id });
    await writeItems(tx, row.id, data);
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "customs_clearance",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  if (result === "order_not_found") return { ok: false, fieldErrors: { orderId: ["not_found"] } };
  return { ok: true, id: result };
}

export async function updateCustomsClearance(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = customsClearanceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.customsClearances.findFirst({
      where: eq(customsClearances.id, id),
    });
    if (!before) return "not_found" as const;
    const after = toRow(data);
    await tx.update(customsClearances).set(after).where(eq(customsClearances.id, id));
    await writeItems(tx, id, data);
    const changes = auditDiff(before, after, AUDITED_FIELDS);
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "customs_clearance",
      entityId: id,
      action: "updated",
      changes: changes.length > 0 ? changes : undefined,
    });
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}

export async function archiveCustomsClearance(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const row = await tx.query.customsClearances.findFirst({
      where: eq(customsClearances.id, id),
    });
    if (!row) return "not_found" as const;
    await tx
      .update(customsClearances)
      .set({ deletedAt: new Date() })
      .where(eq(customsClearances.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "customs_clearance",
      entityId: id,
      action: "archived",
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}

export async function restoreCustomsClearance(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  await db.transaction(async (tx) => {
    await tx.update(customsClearances).set({ deletedAt: null }).where(eq(customsClearances.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "customs_clearance",
      entityId: id,
      action: "restored",
    });
  });
  return { ok: true, id };
}
