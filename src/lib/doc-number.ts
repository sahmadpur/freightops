import { sql } from "drizzle-orm";
import { docCounters } from "@/db/schema";
import type { db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DocKind = "invoice" | "act";

const PREFIX: Record<DocKind, string> = { invoice: "INV", act: "ACT" };

/** Returns an INV/ACT-YYYY-NNN string; seq is left-padded to 3 digits and never truncated. */
export function formatDocNumber(kind: DocKind, year: number, seq: number): string {
  return `${PREFIX[kind]}-${year}-${String(seq).padStart(3, "0")}`;
}

/**
 * Atomically allocate the next document number for `(kind, year)`. MUST run
 * inside a transaction. The upsert takes a row lock on the counter, so
 * concurrent generations serialize and never collide. A failure after
 * allocation leaves a gap in the sequence — accepted for v1.
 */
export async function nextDocNumber(tx: Tx, kind: DocKind, year: number): Promise<string> {
  const [row] = await tx
    .insert(docCounters)
    .values({ kind, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [docCounters.kind, docCounters.year],
      set: { lastNumber: sql`${docCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: docCounters.lastNumber });
  return formatDocNumber(kind, year, row.lastNumber);
}
