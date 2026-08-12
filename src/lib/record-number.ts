import { and, eq, sql } from "drizzle-orm";
import { annualCounters, monthlyCounters } from "@/db/schema";
import type { db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Monthly counter kinds. The prefix is what the number is rendered with.
 *
 * Orders issued before the CRM spec landed carry legacy `ALL2607001` numbers
 * and keep them forever; all new orders are numbered by the annual family below.
 */
export const RECORD_PREFIX = {
  customs: "CC",
} as const;

export type RecordKind = keyof typeof RECORD_PREFIX;

/**
 * `CC2607001` — prefix, 2-digit year, 2-digit month, 3-digit sequence.
 * The sequence restarts every month, so it is only unique within its month;
 * the year/month segment is what makes the whole number unique.
 *
 * `seq` is left-padded to 3 digits and never truncated: a 4-digit month would
 * render as `CC26071000` rather than silently colliding.
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

/**
 * Year-sequential counter kinds, the format the CRM specification calls for:
 * `REQ-2026-0145`, `ORD-2026-0087`. The sequence restarts every January.
 */
export const ANNUAL_PREFIX = {
  request: "REQ",
  order: "ORD",
} as const;

export type AnnualKind = keyof typeof ANNUAL_PREFIX;

/**
 * `REQ-2026-0145` — prefix, full year, 4-digit sequence.
 *
 * `seq` is left-padded to 4 digits and never truncated: the 10 000th request of
 * a year renders as `REQ-2026-10000` rather than silently colliding.
 */
export function formatAnnualNumber(kind: AnnualKind, year: number, seq: number): string {
  return `${ANNUAL_PREFIX[kind]}-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Atomically allocate the next number for `kind` in the given year. MUST run
 * inside the creating transaction — same row-lock upsert as `nextRecordNumber`.
 */
export async function nextAnnualNumber(tx: Tx, kind: AnnualKind, year: number): Promise<string> {
  const [row] = await tx
    .insert(annualCounters)
    .values({ kind, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [annualCounters.kind, annualCounters.year],
      set: { lastNumber: sql`${annualCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: annualCounters.lastNumber });
  return formatAnnualNumber(kind, year, row.lastNumber);
}

/** Non-consuming peek, for form previews only. Not authoritative. */
export async function peekAnnualNumber(
  executor: Pick<typeof db, "select">,
  kind: AnnualKind,
  year: number,
): Promise<string> {
  const [row] = await executor
    .select({ lastNumber: annualCounters.lastNumber })
    .from(annualCounters)
    .where(and(eq(annualCounters.kind, kind), eq(annualCounters.year, year)));
  return formatAnnualNumber(kind, year, (row?.lastNumber ?? 0) + 1);
}
