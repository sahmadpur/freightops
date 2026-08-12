"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, documents, orderFinanceLines, orders, quotations, requests } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { nextAnnualNumber } from "@/lib/record-number";
import { DEFAULT_CURRENCY } from "@/lib/fx";
import { buildRequestTitle } from "@/lib/request-title";
import { timestampFor, type RequestStatus } from "@/lib/request-status";
import { canSuperviseTeam, type Role } from "@/lib/roles";
import { orderRecipients } from "@/modules/notifications/recipients";
import { enqueueMany } from "@/modules/notifications/enqueue";
import { orderCreatedEmail } from "@/modules/notifications/templates";
import {
  convertToOrderSchema,
  missingForStatus,
  orderSourceFields,
  requestInputSchema,
  requestStatusChangeSchema,
  type ActionResult,
  type RequestInput,
} from "./schema";
import { contactOptions } from "./queries";
import { shipmentColumns } from "@/modules/orders/shipment-columns";
import { copyShipment, deleteShipment, readCargo, readLegs, writeCargo, writeLegs } from "./shipment";
import { deleteTasksFor } from "@/modules/tasks/cascade";

/**
 * Fields whose changes are worth a history entry. Timestamps are excluded: they
 * are stamped by status changes, which are audited in their own right, so
 * logging both would double every transition.
 */
const AUDITED_FIELDS = [
  "title",
  "accountId",
  "contactId",
  "responsibleUserId",
  "leadSource",
  "sourceAgentAccountId",
  "emailSubject",
  "transportFamily",
  "incoterms",
  "incotermPlace",
  "cargoReadyDate",
  "requestedDeliveryDate",
  "receivedAt",
];

const t = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

/** The shape written to the `requests` row; legs and cargo are handled separately. */
function toRow(data: RequestInput) {
  return {
    accountId: t(data.accountId),
    contactId: t(data.contactId),
    responsibleUserId: data.responsibleUserId,
    leadSource: data.leadSource,
    sourceAgentAccountId: t(data.sourceAgentAccountId),
    sourceNote: t(data.sourceNote),
    emailSubject: t(data.emailSubject),
    transportFamily: (t(data.transportFamily) ?? null) as (typeof requests.$inferInsert)["transportFamily"],
    incoterms: (t(data.incoterms) ?? null) as (typeof requests.$inferInsert)["incoterms"],
    incotermPlace: t(data.incotermPlace),
    cargoReadyDate: t(data.cargoReadyDate),
    requestedDeliveryDate: t(data.requestedDeliveryDate),
    specialInstructions: t(data.specialInstructions),
    receivedAt: new Date(data.receivedAt),
  };
}

/**
 * Fall back to a generated title when the form sent none. The form normally
 * builds it from translated labels; this keeps a request created by any other
 * path (a seed, a future web form, the Outlook add-in) from being nameless.
 */
async function fallbackTitle(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  data: RequestInput,
): Promise<string> {
  let clientName: string | null = null;
  const accountId = t(data.accountId);
  if (accountId) {
    const [row] = await tx.select({ title: accounts.title }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
    clientName = row?.title ?? null;
  }
  const first = data.legs[0];
  const last = data.legs[data.legs.length - 1];
  const family = t(data.transportFamily);
  const subtype = data.legs.length === 1 ? t(first?.subtype) : null;
  const title = buildRequestTitle({
    clientName,
    origin: t(first?.originCity) ?? t(first?.originCountry),
    destination: t(last?.destinationCity) ?? t(last?.destinationCountry),
    transport: family ? family[0].toUpperCase() + family.slice(1) : null,
    subtype: subtype ? subtype.toUpperCase() : null,
  });
  return title || "—";
}

export async function createRequest(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = requestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const row = toRow(data);
    // Numbered by the year the enquiry arrived, not the year it was typed in,
    // so a request registered late on 1 January still belongs to the old year's
    // sequence alongside the rest of that year's KPI data.
    const number = await nextAnnualNumber(tx, "request", row.receivedAt.getFullYear());
    const title = t(data.title) ?? (await fallbackTitle(tx, data));

    const [created] = await tx
      .insert(requests)
      .values({ ...row, number, title, createdBy: session.user.id })
      .returning({ id: requests.id });

    await writeLegs(tx, "request", created.id, data.legs);
    await writeCargo(tx, "request", created.id, data.cargo);

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: created.id,
      action: "created",
    });
    return created.id;
  });

  return { ok: true, id };
}

export async function updateRequest(id: string, input: unknown): Promise<ActionResult> {
  const { session, role } = await requireArea("staff");
  const parsed = requestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.requests.findFirst({ where: eq(requests.id, id) });
    if (!before) return "not_found" as const;
    // Reassigning someone else's request is a supervisor's call (§25).
    if (
      before.responsibleUserId !== data.responsibleUserId &&
      before.responsibleUserId !== session.user.id &&
      !canSuperviseTeam(role as Role)
    ) {
      return "not_allowed" as const;
    }

    const after = toRow(data);
    const title = t(data.title) ?? (await fallbackTitle(tx, data));
    await tx.update(requests).set({ ...after, title }).where(eq(requests.id, id));

    await writeLegs(tx, "request", id, data.legs);
    await writeCargo(tx, "request", id, data.cargo);

    const changes = auditDiff({ ...before }, { ...after, title }, AUDITED_FIELDS);
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "request",
        entityId: id,
        action: "updated",
        changes,
      });
    }
    // Route, transport and cargo are separate tables, so auditDiff cannot see
    // them. One marker entry keeps the history honest without exploding into a
    // row per leg column.
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: id,
      action: "shipment_updated",
    });
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "not_allowed") return { ok: false, error: "not_allowed" };
  return { ok: true, id };
}

/**
 * Move a request through its commercial lifecycle, stamping the KPI timestamp
 * the target status owns (§23) in the same transaction as the audit entry.
 *
 * A timestamp is only ever stamped once: re-entering `quotation` after going
 * back and forth keeps the original start time, because time-to-quote measures
 * the first attempt, not the last.
 */
export async function changeRequestStatus(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = requestStatusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const { status, lostReason, lostReasonNote } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.requests.findFirst({ where: eq(requests.id, id) });
    if (!before) return "not_found" as const;
    if (before.status === status && !lostReason) return "ok" as const;
    // Won is not a manual status: it is what converting to an order sets, so
    // that a won request always has the order to prove it (§14).
    if (status === "won" && !before.orderId) return "convert_instead" as const;

    const legs = await readLegs(tx, "request", id);
    const cargo = await readCargo(tx, "request", id);
    const missing = missingForStatus(status as RequestStatus, {
      accountId: before.accountId,
      transportFamily: before.transportFamily,
      legs,
      cargoDescription: cargo?.description ?? null,
    });
    if (missing.length > 0) {
      return { kind: "incomplete" as const, missing };
    }

    const stamp = timestampFor(status as RequestStatus);
    const patch: Partial<typeof requests.$inferInsert> = {
      status,
      lostReason: (lostReason || null) as (typeof requests.$inferInsert)["lostReason"],
      lostReasonNote: lostReasonNote || null,
    };
    if (stamp && before[stamp] === null) patch[stamp] = new Date();

    await tx.update(requests).set(patch).where(eq(requests.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: id,
      action: "status_changed",
      changes: [{ field: "status", oldValue: before.status, newValue: status }],
    });
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "convert_instead") return { ok: false, error: "convert_instead" };
  if (typeof result === "object") {
    return { ok: false, error: "incomplete", fieldErrors: { status: result.missing } };
  }
  return { ok: true, id };
}

/** Soft-delete (archive) a request. A converted one stays, as the order's paper trail. */
export async function archiveRequest(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const row = await tx.query.requests.findFirst({ where: eq(requests.id, id) });
    if (!row) return "not_found" as const;
    if (row.orderId) return "has_order" as const;
    await tx.update(requests).set({ deletedAt: new Date() }).where(eq(requests.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "request", entityId: id, action: "archived" });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "has_order") return { ok: false, error: "has_order" };
  return { ok: true, id };
}

export async function restoreRequest(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  await db.transaction(async (tx) => {
    await tx.update(requests).set({ deletedAt: null }).where(eq(requests.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "request", entityId: id, action: "restored" });
  });
  return { ok: true, id };
}

/** Hard-delete a draft that was never worked. Legs and cargo have no DB cascade. */
export async function deleteRequestDraft(id: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const row = await tx.query.requests.findFirst({ where: eq(requests.id, id) });
    if (!row) return "not_found" as const;
    if (row.status !== "new" || row.orderId) return "not_allowed" as const;
    await deleteShipment(tx, "request", id);
    await deleteTasksFor(tx, "request", id);
    await tx.delete(requests).where(eq(requests.id, id));
    await recordAudit(tx, { userId: session.user.id, entityType: "request", entityId: id, action: "deleted" });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "not_allowed") return { ok: false, error: "not_allowed" };
  return { ok: true, id };
}

/**
 * Contacts for a company, for the Contact Person dropdown. Exposed as an action
 * because the client picker reloads it whenever the chosen client changes (§5).
 */
export async function fetchContactOptions(accountId: string) {
  await requireArea("staff");
  return contactOptions(accountId);
}

/**
 * Turn a won request into an order (§14).
 *
 * Two entry points, one mechanism: `from_quotation` carries the accepted offer's
 * numbers across, `direct` creates the order with no price at all — which §16
 * requires, because urgent cargo is collected before anyone has quoted it.
 *
 * The request is NOT consumed. It stays at `won` with a link to the order, so
 * the commercial history of how the shipment was sold survives (§3).
 */
export async function convertToOrder(requestId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = convertToOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const { mode, carrierId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const request = await tx.query.requests.findFirst({ where: eq(requests.id, requestId) });
    if (!request) return "not_found" as const;
    if (request.orderId) return "already_converted" as const;
    if (!request.accountId) return "no_client" as const;

    const legs = await readLegs(tx, "request", requestId);
    const cargo = await readCargo(tx, "request", requestId);

    // The accepted offer, when there is one. Absent for a direct order, and the
    // order is created anyway — that is the whole point of the direct path.
    const [quotation] =
      mode === "from_quotation"
        ? await tx
            .select()
            .from(quotations)
            .where(eq(quotations.requestId, requestId))
            .orderBy(desc(quotations.version))
            .limit(1)
        : [];
    if (mode === "from_quotation" && !quotation) return "no_quotation" as const;

    const now = new Date();
    const number = await nextAnnualNumber(tx, "order", now.getFullYear());

    const [order] = await tx
      .insert(orders)
      .values({
        number,
        title: request.title,
        accountId: request.accountId,
        carrierId: carrierId || null,
        // The legs are authoritative; these denormalized fields keep the order
        // list, filters and dashboard working unchanged.
        ...shipmentColumns(legs, cargo),
        incoterms: request.incoterms,
        ...orderSourceFields(request, quotation?.id ?? null),
        currency: quotation?.currency ?? DEFAULT_CURRENCY,
        clientCharge: quotation?.sellingPrice ?? null,
        createdBy: session.user.id,
      })
      .returning({ id: orders.id });

    // Route, transport detail and cargo move across as rows, so nothing is
    // re-keyed by hand (§28).
    await copyShipment(tx, { parentType: "request", parentId: requestId }, { parentType: "order", parentId: order.id });

    // Request documents follow the order as new rows pointing at the same S3
    // objects — a link copy, never a re-upload. The request keeps its own rows.
    const requestDocs = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.parentType, "request"), eq(documents.parentId, requestId)));
    if (requestDocs.length > 0) {
      await tx.insert(documents).values(
        requestDocs.map(({ id: _id, createdAt: _createdAt, ...doc }) => ({
          ...doc,
          parentType: "order" as const,
          parentId: order.id,
        })),
      );
    }

    // Seed the Finance tab from the accepted offer so the rollup and the lines
    // start consistent, exactly as createOrder does.
    if (quotation?.sellingPrice) {
      await tx.insert(orderFinanceLines).values({
        orderId: order.id,
        side: "revenue",
        description: "Freight forwarding services",
        amount: quotation.sellingPrice,
        createdBy: session.user.id,
      });
    }

    await tx
      .update(requests)
      .set({
        orderId: order.id,
        status: "won",
        decisionAt: request.decisionAt ?? now,
        orderCreatedAt: now,
      })
      .where(eq(requests.id, requestId));

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: requestId,
      action: "order_created",
      changes: [{ field: "status", oldValue: request.status, newValue: "won" }],
    });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: order.id,
      action: "created",
    });

    const { clientEmails, carrierEmails } = await orderRecipients(tx, order.id);
    await enqueueMany(
      tx,
      [...clientEmails, ...carrierEmails],
      orderCreatedEmail({
        orderNumber: number,
        orderTitle: request.title,
        url: `${process.env.APP_BASE_URL}/orders/${order.id}`,
      }),
      { type: "order", id: order.id },
    );

    return order.id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "already_converted") return { ok: false, error: "already_converted" };
  if (result === "no_client") return { ok: false, error: "no_client" };
  if (result === "no_quotation") return { ok: false, error: "no_quotation" };
  return { ok: true, id: result };
}
