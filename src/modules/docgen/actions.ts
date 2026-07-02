"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, orders } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/doc-number";
import { toCents } from "@/lib/money";
import { htmlToPdf } from "@/lib/pdf";
import { deleteObject, putObject } from "@/lib/s3";
import { requireArea } from "@/lib/session";
import { buildS3Key } from "@/lib/upload";
import { ISSUER } from "./issuer";
import { getOrderForDocgen, type OrderForDocgen } from "./queries";
import { generateDocInputSchema, type GenerateDocInput } from "./schema";
import { renderActHtml } from "./templates/act";
import { renderInvoiceHtml } from "./templates/invoice";
import { COMMON_STRINGS } from "./templates/strings";
import type { DocData, DocLine } from "./templates/types";
import type { ActionResult } from "@/lib/forms";

function buildLines(row: OrderForDocgen, input: GenerateDocInput): DocLine[] {
  const t = COMMON_STRINGS[input.language];
  const lines: DocLine[] = [
    { description: t.serviceForOrder(row.number), amountCents: toCents(row.clientCharge) },
  ];
  const additional = toCents(row.additionalCosts);
  if (additional > 0) {
    lines.push({
      description: row.additionalCostsNote || t.additionalCharges,
      amountCents: additional,
    });
  }
  return lines;
}

/** Generate an invoice or ACT PDF for an order and file it as a document. */
export async function generateOrderDocument(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const parsed = generateDocInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const row = await getOrderForDocgen(d.orderId);
  if (!row) return { ok: false, error: "not_found" };

  // Allocate the number first in its own small transaction (auto mode only).
  // A failure later in the flow leaves a gap in the sequence — accepted for v1.
  const year = Number(d.date.slice(0, 4));
  const number =
    d.numberMode === "auto"
      ? await db.transaction((tx) => nextDocNumber(tx, d.kind, year))
      : d.number!;

  const lines = buildLines(row, d);
  const data: DocData = {
    issuer: ISSUER,
    client: { title: row.accountTitle, taxId: row.accountTaxId, address: row.accountAddress },
    number,
    date: d.date,
    order: {
      number: row.number,
      clientOrderId: row.clientOrderId,
      route: row.route,
      cargoDescription: row.cargoDescription,
      packages: row.packages,
      weightKg: row.weightKg,
      volumeM3: row.volumeM3,
      incoterms: row.incoterms,
    },
    lines,
    totalCents: lines.reduce((acc, l) => acc + l.amountCents, 0),
  };
  const html =
    d.kind === "invoice" ? renderInvoiceHtml(data, d.language) : renderActHtml(data, d.language);
  const pdf = await htmlToPdf(html);

  // Persist like the upload flow: object first, roll it back if the DB write fails.
  const id = randomUUID();
  const fileName = `${number.replace(/[^\w.-]+/g, "-")}.pdf`;
  const key = buildS3Key("order", d.orderId, id, fileName);
  await putObject(key, pdf, "application/pdf");

  try {
    await db.transaction(async (tx) => {
      await tx.insert(documents).values({
        id,
        parentType: "order",
        parentId: d.orderId,
        fileName,
        docType: d.kind,
        sizeBytes: pdf.length,
        s3Key: key,
        visibleToClient: d.visibleToClient,
        createdBy: session.user.id,
      });
      const patch =
        d.kind === "invoice"
          ? { invoiceNumber: number, invoiceDate: d.date }
          : { actNumber: number, actDate: d.date };
      await tx.update(orders).set(patch).where(eq(orders.id, d.orderId));
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "order",
        entityId: d.orderId,
        action: "document_generated",
        changes: [
          {
            field: d.kind === "invoice" ? "invoiceNumber" : "actNumber",
            oldValue: d.kind === "invoice" ? row.invoiceNumber : row.actNumber,
            newValue: number,
          },
        ],
      });
    });
  } catch (err) {
    await deleteObject(key).catch((e) =>
      console.error("[docgen] orphan object cleanup failed:", key, e),
    );
    throw err;
  }

  return { ok: true, id };
}
