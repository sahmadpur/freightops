"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderFinanceLines, orders } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { nextAnnualNumber } from "@/lib/record-number";
import { requireArea } from "@/lib/session";
import { missingFinancials } from "@/lib/order-financials";
import { orderInputSchema, statusChangeSchema, type OrderInput } from "./schema";
import type { ActionResult } from "@/lib/forms";
import { orderRecipients, staffRecipientsForOrder } from "@/modules/notifications/recipients";
import { enqueueMany } from "@/modules/notifications/enqueue";
import {
  invoiceRequiredEmail,
  orderCreatedEmail,
  orderStatusChangedEmail,
} from "@/modules/notifications/templates";

// Money rollups (clientCharge/carrierCost) are edited via finance lines, not the
// order form, so they're audited by the finance-line actions instead.
const AUDITED_FIELDS = [
  "title", "rollbackNumber", "accountId", "carrierId", "transportType",
  "fromCountry", "toCountry", "cargoItems", "packages", "weightKg", "volumeM3",
  "incoterms", "deliveryFormat", "currency", "exchangeRate",
];

function toRow(data: OrderInput) {
  return {
    title: data.title,
    rollbackNumber: data.rollbackNumber || null,
    accountId: data.accountId,
    carrierId: data.carrierId || null,
    transportType: data.transportType || null,
    fromCountry: data.fromCountry || null,
    toCountry: data.toCountry || null,
    cargoItems: data.cargoItems,
    packages: data.packages ? Number(data.packages) : null,
    weightKg: data.weightKg || null,
    volumeM3: data.volumeM3 || null,
    incoterms: data.incoterms || null,
    deliveryFormat: data.deliveryFormat || null,
    currency: data.currency,
    exchangeRate: data.exchangeRate || null,
  };
}

export async function createOrder(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const costLines = data.costLines.filter((l) => l.amount);
  const costTotal = costLines.reduce((sum, l) => sum + Number(l.amount), 0);

  const id = await db.transaction(async (tx) => {
    const now = new Date();
    const number = await nextAnnualNumber(tx, "order", now.getFullYear());
    const [row] = await tx
      .insert(orders)
      .values({
        ...toRow(data),
        // Rollups seeded from the quick-entry totals below; refined via finance lines.
        clientCharge: data.clientCharge || null,
        carrierCost: costTotal ? costTotal.toFixed(2) : null,
        number,
        createdBy: session.user.id,
      })
      .returning({ id: orders.id });
    // Seed the itemized Finance tab so it starts consistent with the rollups.
    const seedLines = [];
    if (data.clientCharge)
      seedLines.push({
        orderId: row.id,
        side: "revenue" as const,
        description: "Freight forwarding services",
        amount: data.clientCharge,
        createdBy: session.user.id,
      });
    costLines.forEach((line, i) =>
      seedLines.push({
        orderId: row.id,
        side: "cost" as const,
        category: line.category,
        description: line.note || line.category,
        amount: line.amount as string,
        note: line.note || null,
        sortOrder: i,
        createdBy: session.user.id,
      }),
    );
    if (seedLines.length) await tx.insert(orderFinanceLines).values(seedLines);
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: row.id,
      action: "created",
    });
    const { clientEmails, carrierEmails } = await orderRecipients(tx, row.id);
    await enqueueMany(
      tx,
      [...clientEmails, ...carrierEmails],
      orderCreatedEmail({
        orderNumber: number,
        orderTitle: data.title,
        url: `${process.env.APP_BASE_URL}/orders/${row.id}`,
      }),
      { type: "order", id: row.id },
    );
    return row.id;
  });

  return { ok: true, id };
}

/** Soft-delete (archive) an order — hidden from lists/aggregates but retained. */
export async function archiveOrder(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const row = await tx.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!row) return "not_found" as const;
    await tx.update(orders).set({ deletedAt: new Date() }).where(eq(orders.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "order", entityId: id, action: "archived" });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}

/** Restore a previously archived order. */
export async function restoreOrder(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ deletedAt: null }).where(eq(orders.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "order", entityId: id, action: "restored" });
  });
  return { ok: true, id };
}

export async function updateOrder(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!before) return "not_found" as const;
    const after = toRow(data);
    await tx.update(orders).set(after).where(eq(orders.id, id));
    const changes = auditDiff(before, after, AUDITED_FIELDS);
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "order",
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

export async function changeOrderStatus(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_status" };
  const { status } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!before) return "not_found" as const;
    if (before.status === status) return "ok" as const;

    // §16: an order may be created without a price, but never closed without
    // one. This is the single gate that enforces it.
    if (status === "closed") {
      const missing = missingFinancials(before);
      if (missing.length > 0) return { kind: "incomplete" as const, missing };
    }

    // Closing an order settles it: it leaves the active list and lands in the
    // archive, where "Show archived" still surfaces it.
    const now = new Date();
    const archiving = status === "closed" && before.deletedAt === null;
    // KPI timestamps are stamped once — reaching a milestone a second time
    // after a correction must not overwrite when it first happened (§23).
    const stamps: Partial<typeof orders.$inferInsert> = {};
    if (status === "delivered" && before.deliveredAt === null) stamps.deliveredAt = now;
    if (status === "closed" && before.closedAt === null) stamps.closedAt = now;

    await tx
      .update(orders)
      .set({ status, ...stamps, ...(archiving ? { deletedAt: now } : {}) })
      .where(eq(orders.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: id,
      action: "status_changed",
      changes: [{ field: "status", oldValue: before.status, newValue: status }],
    });
    if (archiving) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "order",
        entityId: id,
        action: "archived",
      });
    }
    const { clientEmails } = await orderRecipients(tx, id);
    await enqueueMany(
      tx,
      clientEmails,
      orderStatusChangedEmail({
        orderNumber: before.number,
        status,
        url: `${process.env.APP_BASE_URL}/orders/${id}`,
      }),
      { type: "order", id },
    );
    // Delivery is the trigger to bill the client. Nudge staff; the invoice is
    // still generated by a human from the order's Documents tab.
    if (status === "delivered" && !before.invoiceNumber) {
      const staffEmails = await staffRecipientsForOrder(tx, id);
      await enqueueMany(
        tx,
        staffEmails,
        invoiceRequiredEmail({
          orderNumber: before.number,
          orderTitle: before.title,
          url: `${process.env.APP_BASE_URL}/orders/${id}`,
        }),
        { type: "order", id },
      );
    }
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  if (typeof result === "object") {
    return { ok: false, error: "financial_data_incomplete", fieldErrors: { status: result.missing } };
  }
  return { ok: true, id };
}
