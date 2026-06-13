import { sql } from "drizzle-orm";
import { orderCounters } from "@/db/schema";
import type { db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function formatOrderNumber(year: number, seq: number): string {
  return `ORD-${year}-${String(seq).padStart(3, "0")}`;
}

/**
 * Atomically allocate the next order number for `year`. MUST run inside the
 * order-creation transaction. The upsert takes a row lock on the counter,
 * so concurrent creates serialize and never collide.
 */
export async function nextOrderNumber(tx: Tx, year: number): Promise<string> {
  const [row] = await tx
    .insert(orderCounters)
    .values({ year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: orderCounters.year,
      set: { lastNumber: sql`${orderCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: orderCounters.lastNumber });
  return formatOrderNumber(year, row.lastNumber);
}
