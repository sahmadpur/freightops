"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, orders } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { routeLabel } from "@/lib/countries";
import { nextDocNumber } from "@/lib/doc-number";
import { convertCents, toCents } from "@/lib/money";
import { htmlToPdf } from "@/lib/pdf";
import { deleteObject, putObject } from "@/lib/s3";
import { requireArea } from "@/lib/session";
import { buildS3Key } from "@/lib/upload";
import { getAznRate } from "@/modules/fx/queries";
import { ISSUER, ISSUER_BANKS } from "./issuer";
import { getOrderForDocgen, type OrderForDocgen } from "./queries";
import { generateDocInputSchema, type GenerateDocInput } from "./schema";
import { renderActHtml } from "./templates/act";
import { renderInvoiceHtml } from "./templates/invoice";
import { COMMON_STRINGS } from "./templates/strings";
import type { DocData, DocLine } from "./templates/types";
import type { ActionResult } from "@/lib/forms";

/**
 * AZN per 1 unit of the order's currency. The rate agreed on the order wins —
 * that is the rate the whole finance module reports in — and CBAR at the
 * document date fills in when the order carries none.
 */
async function orderAznRate(row: OrderForDocgen, isoDate: string): Promise<number | null> {
  const stored = Number(row.exchangeRate);
  if (row.exchangeRate && Number.isFinite(stored) && stored > 0) return stored;
  const fetched = await getAznRate(row.currency, isoDate);
  return fetched ? Number(fetched) : null;
}

function buildLines(row: OrderForDocgen, input: GenerateDocInput): DocLine[] {
  const t = COMMON_STRINGS[input.language];
  // Itemized revenue lines; fall back to the single clientCharge rollup. The
  // package count is the shipment's, so it belongs to the freight line only —
  // additional charges leave the quantity cell empty.
  if (row.revenueLines.length === 0) {
    return [
      {
        description: t.serviceForOrder(row.number),
        quantity: row.packages,
        amountCents: toCents(row.clientCharge),
      },
    ];
  }
  return row.revenueLines.map((l, i) => ({
    description: l.description,
    quantity: i === 0 ? row.packages : null,
    amountCents: toCents(l.amount),
  }));
}

/**
 * Restate the lines in the document's currency, cross-converting through AZN.
 * Returns null when no rate can be established for either side — a document
 * must never quote an amount at a guessed rate.
 */
async function convertLines(
  lines: DocLine[],
  row: OrderForDocgen,
  input: GenerateDocInput,
): Promise<DocLine[] | null> {
  if (row.currency === input.currency) return lines;
  const fromRate = await orderAznRate(row, input.date);
  const toRateStr = await getAznRate(input.currency, input.date);
  const toRate = toRateStr ? Number(toRateStr) : null;
  if (!fromRate || !toRate) return null;
  return lines.map((l) => ({ ...l, amountCents: convertCents(l.amountCents, fromRate, toRate) }));
}

/** Generate an invoice or ACT PDF for an order and file it as a document. */
export async function generateOrderDocument(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const parsed = generateDocInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const row = await getOrderForDocgen(d.orderId);
  if (!row) return { ok: false, error: "not_found" };

  // Establish the amounts before allocating a number, so a missing FX rate
  // doesn't burn a sequence number.
  const lines = await convertLines(buildLines(row, d), row, d);
  if (!lines) return { ok: false, error: "no_rate" };

  // Allocate the number in its own small transaction (auto mode only). A failure
  // later in the flow leaves a gap in the sequence — accepted for v1.
  const number =
    d.numberMode === "auto"
      ? await db.transaction((tx) => nextDocNumber(tx, d.kind, d.date))
      : d.number!;

  const data: DocData = {
    issuer: ISSUER,
    bank: ISSUER_BANKS[d.currency],
    client: { title: row.accountTitle, taxId: row.accountTaxId, address: row.accountAddress },
    number,
    date: d.date,
    currency: d.currency,
    order: {
      number: row.number,
      // Documents are issued in one of three languages; render the route with
      // country names in that language rather than bare ISO codes.
      route: routeLabel(row.fromCountry, row.toCountry, d.language, { flags: false }),
      cargoDescription: row.cargoItems.length ? row.cargoItems.join(", ") : null,
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
        currency: d.currency,
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
