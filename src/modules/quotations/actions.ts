"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotations, requests } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { quotationInputSchema, type ActionResult } from "./schema";

const t = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

/**
 * Save the working quotation for a request.
 *
 * A quotation that has already been sent is never edited in place: the client
 * has seen those numbers, so a change creates the next version and leaves the
 * old one as history. An unsent draft is simply updated.
 *
 * Opening the commercial stage also moves the request into `quotation` and
 * stamps `quotation_started_at`, so time-to-quote is measured from the moment
 * work actually began rather than from a manual status change someone forgot.
 */
export async function saveQuotation(requestId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = quotationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const values = {
    currency: d.currency,
    expectedCostTotal: t(d.expectedCostTotal),
    sellingPrice: t(d.sellingPrice),
    validUntil: t(d.validUntil),
    transitTimeDays: d.transitTimeDays ? Number(d.transitTimeDays) : null,
    terms: t(d.terms),
    notes: t(d.notes),
  };

  const result = await db.transaction(async (tx) => {
    const request = await tx.query.requests.findFirst({ where: eq(requests.id, requestId) });
    if (!request) return "not_found" as const;

    const [current] = await tx
      .select()
      .from(quotations)
      .where(eq(quotations.requestId, requestId))
      .orderBy(desc(quotations.version))
      .limit(1);

    let id: string;
    let action: string;
    if (!current) {
      const [row] = await tx
        .insert(quotations)
        .values({ requestId, version: 1, ...values, createdBy: session.user.id })
        .returning({ id: quotations.id });
      id = row.id;
      action = "quotation_created";
    } else if (current.sentAt) {
      const [row] = await tx
        .insert(quotations)
        .values({ requestId, version: current.version + 1, ...values, createdBy: session.user.id })
        .returning({ id: quotations.id });
      id = row.id;
      action = "quotation_revised";
    } else {
      await tx.update(quotations).set(values).where(eq(quotations.id, current.id));
      id = current.id;
      action = "quotation_updated";
    }

    // Entering the commercial stage. Only nudges a request that is still being
    // worked — a won, lost or cancelled one keeps the status it was decided at.
    const patch: Partial<typeof requests.$inferInsert> = {};
    if (request.status === "new" || request.status === "in_progress") patch.status = "quotation";
    if (request.quotationStartedAt === null) patch.quotationStartedAt = new Date();
    if (Object.keys(patch).length > 0) {
      await tx.update(requests).set(patch).where(eq(requests.id, requestId));
    }

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: requestId,
      action,
    });
    return id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

/**
 * Record that the current offer went to the client (§11, §23).
 *
 * `quotation_sent_at` is stamped once and never moved: time-to-quote measures
 * how fast the desk answered the first time, so a revised offer sent later must
 * not make the original response look slower than it was.
 */
export async function markQuotationSent(requestId: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const result = await db.transaction(async (tx) => {
    const request = await tx.query.requests.findFirst({ where: eq(requests.id, requestId) });
    if (!request) return "not_found" as const;

    const [current] = await tx
      .select()
      .from(quotations)
      .where(eq(quotations.requestId, requestId))
      .orderBy(desc(quotations.version))
      .limit(1);
    if (!current) return "no_quotation" as const;
    if (current.sentAt) return "ok" as const;

    const now = new Date();
    await tx.update(quotations).set({ sentAt: now }).where(eq(quotations.id, current.id));

    const patch: Partial<typeof requests.$inferInsert> = { status: "quotation_sent" };
    if (request.quotationSentAt === null) patch.quotationSentAt = now;
    if (request.quotationStartedAt === null) patch.quotationStartedAt = now;
    await tx.update(requests).set(patch).where(eq(requests.id, requestId));

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: requestId,
      action: "quotation_sent",
      changes: [{ field: "status", oldValue: request.status, newValue: "quotation_sent" }],
    });
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "no_quotation") return { ok: false, error: "no_quotation" };
  return { ok: true, id: requestId };
}
