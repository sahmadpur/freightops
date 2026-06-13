"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { paymentInputSchema, financialsInputSchema } from "./schema";
import type { ActionResult } from "@/lib/forms";

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

const FINANCIAL_FIELDS = ["amountReceivable", "amountPayable"];

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
