import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, docCounters, orders } from "@/db/schema";
import { formatDocNumber, type DocKind } from "@/lib/doc-number";

/**
 * Non-consuming preview of the next document number for the generate form.
 * Under concurrency the number actually allocated at generate time may
 * differ — the allocated one is authoritative.
 */
export async function peekNextDocNumber(kind: DocKind, year: number): Promise<string> {
  const row = await db.query.docCounters.findFirst({
    where: and(eq(docCounters.kind, kind), eq(docCounters.year, year)),
  });
  return formatDocNumber(kind, year, (row?.lastNumber ?? 0) + 1);
}

/** Everything the invoice/ACT templates need, in one join. */
export async function getOrderForDocgen(orderId: string) {
  const [row] = await db
    .select({
      id: orders.id,
      number: orders.number,
      clientOrderId: orders.clientOrderId,
      route: orders.route,
      cargoDescription: orders.cargoDescription,
      packages: orders.packages,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      incoterms: orders.incoterms,
      clientCharge: orders.clientCharge,
      additionalCosts: orders.additionalCosts,
      additionalCostsNote: orders.additionalCostsNote,
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
  return row ?? null;
}

export type OrderForDocgen = NonNullable<Awaited<ReturnType<typeof getOrderForDocgen>>>;
