"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderFinanceLines, orders, payments } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { paymentInputSchema, financialsInputSchema, financeLineInputSchema } from "./schema";
import type { ActionResult } from "@/lib/forms";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Recompute the cached order rollups from its finance lines:
 * clientCharge = Σ revenue lines, carrierCost = Σ cost lines. Runs inside the
 * same transaction as any line mutation so the cache never drifts.
 */
async function recomputeOrderRollups(tx: Tx, orderId: string): Promise<void> {
  const [agg] = await tx
    .select({
      revenue: sql<string>`coalesce(sum(${orderFinanceLines.amount}) filter (where ${orderFinanceLines.side} = 'revenue'), 0)`,
      cost: sql<string>`coalesce(sum(${orderFinanceLines.amount}) filter (where ${orderFinanceLines.side} = 'cost'), 0)`,
    })
    .from(orderFinanceLines)
    .where(eq(orderFinanceLines.orderId, orderId));
  await tx
    .update(orders)
    .set({ clientCharge: agg.revenue, carrierCost: agg.cost })
    .where(eq(orders.id, orderId));
}

export async function addPayment(orderId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return "not_found" as const;
    const [row] = await tx
      .insert(payments)
      .values({
        orderId,
        direction: data.direction,
        amount: data.amount,
        paidAt: new Date(data.paidAt),
        note: data.note || null,
        createdBy: session.user.id,
      })
      .returning({ id: payments.id });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: orderId,
      action: "payment_added",
      changes: [{ field: data.direction === "incoming" ? "received" : "paid", oldValue: null, newValue: data.amount }],
    });
    return row.id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const result = await db.transaction(async (tx) => {
    const payment = await tx.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment) return "not_found" as const;
    await tx.delete(payments).where(eq(payments.id, paymentId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: payment.orderId,
      action: "payment_removed",
      changes: [{ field: payment.direction === "incoming" ? "received" : "paid", oldValue: payment.amount, newValue: null }],
    });
    return payment.orderId;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

const FINANCIAL_FIELDS = [
  "amountReceivable",
  "amountPayable",
  "carrierInvoiceNumber",
  "carrierInvoiceDate",
];

export async function updateOrderFinancials(orderId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = financialsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!before) return "not_found" as const;
    const after = {
      amountReceivable: data.amountReceivable || null,
      amountPayable: data.amountPayable || null,
      carrierInvoiceNumber: data.carrierInvoiceNumber || null,
      carrierInvoiceDate: data.carrierInvoiceDate || null,
    };
    await tx.update(orders).set(after).where(eq(orders.id, orderId));
    const changes = auditDiff(before, after, FINANCIAL_FIELDS);
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "order",
        entityId: orderId,
        action: "financials_updated",
        changes,
      });
    }
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: orderId };
}

/** Add a revenue/cost line to an order and refresh the cached rollups. */
export async function addFinanceLine(orderId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = financeLineInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return "not_found" as const;
    const [row] = await tx
      .insert(orderFinanceLines)
      .values({
        orderId,
        side: data.side,
        category: data.category,
        description: data.description,
        amount: data.amount,
        note: data.note || null,
        createdBy: session.user.id,
      })
      .returning({ id: orderFinanceLines.id });
    await recomputeOrderRollups(tx, orderId);
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: orderId,
      action: "finance_line_added",
      changes: [{ field: data.side, oldValue: null, newValue: `${data.description}: ${data.amount}` }],
    });
    return row.id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

/** Remove a finance line and refresh the cached rollups. */
export async function deleteFinanceLine(lineId: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const result = await db.transaction(async (tx) => {
    const line = await tx.query.orderFinanceLines.findFirst({
      where: eq(orderFinanceLines.id, lineId),
    });
    if (!line) return "not_found" as const;
    await tx.delete(orderFinanceLines).where(eq(orderFinanceLines.id, lineId));
    await recomputeOrderRollups(tx, line.orderId);
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: line.orderId,
      action: "finance_line_removed",
      changes: [{ field: line.side, oldValue: `${line.description}: ${line.amount}`, newValue: null }],
    });
    return line.orderId;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}
