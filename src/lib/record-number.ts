import { and, eq, sql } from "drizzle-orm";
import { monthlyCounters } from "@/db/schema";
import type { db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Counter kinds. The prefix is what the number is rendered with. */
export const RECORD_PREFIX = {
  order: "ALL",
  customs: "CC",
} as const;

export type RecordKind = keyof typeof RECORD_PREFIX;

/**
 * `ALL2607001` — prefix, 2-digit year, 2-digit month, 3-digit sequence.
 * The sequence restarts every month, so it is only unique within its month;
 * the year/month segment is what makes the whole number unique.
 *
 * `seq` is left-padded to 3 digits and never truncated: a 4-digit month would
 * render as `ALL26071000` rather than silently colliding.
 */
export function formatRecordNumber(
  kind: RecordKind,
  year: number,
  month: number,
  seq: number,
): string {
  const yy = String(year % 100).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${RECORD_PREFIX[kind]}${yy}${mm}${String(seq).padStart(3, "0")}`;
}

/**
 * Atomically allocate the next number for `kind` in the given month. MUST run
 * inside the creating transaction: the upsert takes a row lock on the counter,
 * so concurrent creates serialize and never collide.
 */
export async function nextRecordNumber(
  tx: Tx,
  kind: RecordKind,
  year: number,
  month: number,
): Promise<string> {
  const [row] = await tx
    .insert(monthlyCounters)
    .values({ kind, year, month, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [monthlyCounters.kind, monthlyCounters.year, monthlyCounters.month],
      set: { lastNumber: sql`${monthlyCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: monthlyCounters.lastNumber });
  return formatRecordNumber(kind, year, month, row.lastNumber);
}

/**
 * Non-consuming peek at what the next number would be — for form previews only.
 * Not authoritative: a concurrent create can take the number before the form is
 * submitted, exactly as with `peekNextDocSeq`.
 */
export async function peekRecordNumber(
  executor: Pick<typeof db, "select">,
  kind: RecordKind,
  year: number,
  month: number,
): Promise<string> {
  const [row] = await executor
    .select({ lastNumber: monthlyCounters.lastNumber })
    .from(monthlyCounters)
    .where(
      and(
        eq(monthlyCounters.kind, kind),
        eq(monthlyCounters.year, year),
        eq(monthlyCounters.month, month),
      ),
    );
  return formatRecordNumber(kind, year, month, (row?.lastNumber ?? 0) + 1);
}
