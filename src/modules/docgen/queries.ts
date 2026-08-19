import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, docCounters, orderFinanceLines, orders } from "@/db/schema";
import type { DocKind } from "@/lib/doc-number";

/**
 * Non-consuming preview of the next sequence number for `(kind, year)`. Returns
 * the raw 1-based sequence; the generate form formats it (the invoice number
 * embeds the document date, which the user can still change). Under concurrency
 * the number actually allocated at generate time may differ — the allocated one
 * is authoritative.
 */
export async function peekNextDocSeq(kind: DocKind, year: number): Promise<number> {
  const row = await db.query.docCounters.findFirst({
    where: and(eq(docCounters.kind, kind), eq(docCounters.year, year)),
  });
  return (row?.lastNumber ?? 0) + 1;
}

/** Everything the invoice/ACT templates need, in one join (+ revenue lines). */
export async function getOrderForDocgen(orderId: string) {
  const [row] = await db
    .select({
      id: orders.id,
      number: orders.number,
      fromCountry: orders.fromCountry,
      toCountry: orders.toCountry,
      cargoItems: orders.cargoItems,
      packages: orders.packages,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      incoterms: orders.incoterms,
      clientCharge: orders.clientCharge,
      currency: orders.currency,
      exchangeRate: orders.exchangeRate,
      invoiceNumber: orders.invoiceNumber,
      actNumber: orders.actNumber,
      accountTitle: accounts.title,
      accountTaxId: accounts.taxId,
      accountAddress: accounts.address,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return null;

  const revenueLines = await db
    .select({ description: orderFinanceLines.description, amount: orderFinanceLines.amount })
    .from(orderFinanceLines)
    .where(and(eq(orderFinanceLines.orderId, orderId), eq(orderFinanceLines.side, "revenue")))
    .orderBy(asc(orderFinanceLines.sortOrder), asc(orderFinanceLines.createdAt));

  return { ...row, revenueLines };
}

export type OrderForDocgen = NonNullable<Awaited<ReturnType<typeof getOrderForDocgen>>>;
