"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderFinanceLines, orders, transportModes } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { nextOrderNumber } from "@/lib/order-number";
import { requireArea } from "@/lib/session";
import { orderInputSchema, statusChangeSchema, type OrderInput } from "./schema";
import type { ActionResult } from "@/lib/forms";
import { orderRecipients } from "@/modules/notifications/recipients";
import { enqueueMany } from "@/modules/notifications/enqueue";
import { orderCreatedEmail, orderStatusChangedEmail } from "@/modules/notifications/templates";

// Money rollups (clientCharge/carrierCost) are edited via finance lines, not the
// order form, so they're audited by the finance-line actions instead.
const AUDITED_FIELDS = [
  "title", "clientOrderId", "accountId", "carrierId", "transportModeId", "route",
  "cargoDescription", "packages", "weightKg", "volumeM3", "incoterms", "deliveryFormat",
  "exchangeRate", "invoiceNumber", "invoiceDate",
  "carrierInvoiceNumber", "carrierInvoiceDate",
];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

class TransportNotFound extends Error {}

function toRow(data: OrderInput) {
  return {
    title: data.title,
    clientOrderId: data.clientOrderId || null,
    accountId: data.accountId,
    carrierId: data.carrierId || null,
    route: data.route || null,
    cargoDescription: data.cargoDescription || null,
    packages: data.packages ? Number(data.packages) : null,
    weightKg: data.weightKg || null,
    volumeM3: data.volumeM3 || null,
    incoterms: data.incoterms || null,
    deliveryFormat: data.deliveryFormat || null,
    exchangeRate: data.exchangeRate || null,
    invoiceNumber: data.invoiceNumber || null,
    invoiceDate: data.invoiceDate || null,
    carrierInvoiceNumber: data.carrierInvoiceNumber || null,
    carrierInvoiceDate: data.carrierInvoiceDate || null,
  };
}

// NOTE: choosing "new" transport while EDITING an order creates a fresh transport mode
// and repoints the order; a previously inline-created mode is left unreferenced (appears
// in the Transportation list). Acceptable for v1; revisit with orphan cleanup if needed.

/** Resolve the transport sub-flow to a transportModeId, creating a new mode if requested. */
async function resolveTransport(tx: Tx, data: OrderInput, userId: string): Promise<string | null> {
  const tr = data.transport;
  if (tr.mode === "none") return null;
  if (tr.mode === "existing") {
    const exists = await tx.query.transportModes.findFirst({
      where: eq(transportModes.id, tr.transportModeId),
      columns: { id: true },
    });
    if (!exists) throw new TransportNotFound();
    return tr.transportModeId;
  }
  const [row] = await tx
    .insert(transportModes)
    .values({
      modeType: tr.modeType,
      number: tr.number,
      fromCountry: tr.fromCountry || null,
      toCountry: tr.toCountry || null,
      route: tr.route || null,
      loadingDate: tr.loadingDate || null,
      plannedArrivalDate: tr.plannedArrivalDate || null,
      totalWeightKg: tr.totalWeightKg || null,
      totalVolumeM3: tr.totalVolumeM3 || null,
      createdBy: userId,
    })
    .returning({ id: transportModes.id });
  await recordAudit(tx, { userId, entityType: "transport_mode", entityId: row.id, action: "created" });
  return row.id;
}

export async function createOrder(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  let id: string;
  try {
    id = await db.transaction(async (tx) => {
      const transportModeId = await resolveTransport(tx, data, session.user.id);
      const number = await nextOrderNumber(tx, new Date().getFullYear());
      const [row] = await tx
        .insert(orders)
        .values({
          ...toRow(data),
          // Rollups seeded from quick-entry totals below; refined via finance lines.
          clientCharge: data.clientCharge || null,
          carrierCost: data.carrierCost || null,
          transportModeId,
          number,
          createdBy: session.user.id,
        })
        .returning({ id: orders.id });
      // Seed one revenue and one cost line from the quick-entry totals so the
      // itemized Finance tab starts consistent with the order's rollups.
      const seedLines = [];
      if (data.clientCharge)
        seedLines.push({ orderId: row.id, side: "revenue" as const, description: "Freight forwarding services", amount: data.clientCharge, createdBy: session.user.id });
      if (data.carrierCost)
        seedLines.push({ orderId: row.id, side: "cost" as const, description: "Carrier cost", amount: data.carrierCost, createdBy: session.user.id });
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
  } catch (e) {
    if (e instanceof TransportNotFound) return { ok: false, fieldErrors: { transport: ["Transport mode not found"] } };
    throw e;
  }

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

  let result: "ok" | "not_found";
  try {
    result = await db.transaction(async (tx) => {
      const before = await tx.query.orders.findFirst({ where: eq(orders.id, id) });
      if (!before) return "not_found" as const;
      const transportModeId = await resolveTransport(tx, data, session.user.id);
      const after = { ...toRow(data), transportModeId };
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
  } catch (e) {
    if (e instanceof TransportNotFound) return { ok: false, fieldErrors: { transport: ["Transport mode not found"] } };
    throw e;
  }

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
    await tx.update(orders).set({ status }).where(eq(orders.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: id,
      action: "status_changed",
      changes: [{ field: "status", oldValue: before.status, newValue: status }],
    });
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
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}
