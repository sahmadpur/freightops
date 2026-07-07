import { sql } from "drizzle-orm";
import { docCounters } from "@/db/schema";
import { formatDocNumber, type DocKind } from "@/lib/doc-number-format";
import type { db } from "@/db";

export type { DocKind } from "@/lib/doc-number-format";
export { formatDocNumber } from "@/lib/doc-number-format";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically allocate the next document number for the year of `isoDate`. MUST
 * run inside a transaction. The upsert takes a row lock on the counter, so
 * concurrent generations serialize and never collide. A failure after
 * allocation leaves a gap in the sequence — accepted for v1. The sequence is
 * per-(kind, year); the invoice number also embeds the document date.
 */
export async function nextDocNumber(tx: Tx, kind: DocKind, isoDate: string): Promise<string> {
  const year = Number(isoDate.slice(0, 4));
  const [row] = await tx
    .insert(docCounters)
    .values({ kind, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [docCounters.kind, docCounters.year],
      set: { lastNumber: sql`${docCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: docCounters.lastNumber });
  return formatDocNumber(kind, isoDate, row.lastNumber);
}
