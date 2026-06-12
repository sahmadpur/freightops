import { auditLog } from "@/db/schema";
import { db } from "@/db";

/** Works with both the root db and a transaction handle. */
export type DbExecutor = Pick<typeof db, "insert">;

export type AuditChange = { field: string; oldValue: string | null; newValue: string | null };

function normalize(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

/** Field-level diff between two records, restricted to `fields`. */
export function auditDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const oldValue = normalize(before[field]);
    const newValue = normalize(after[field]);
    if (oldValue !== newValue) changes.push({ field, oldValue, newValue });
  }
  return changes;
}

/**
 * Insert audit rows. MUST be called with the surrounding transaction handle
 * so history can never drift from the data (spec §3 "audit_log").
 * One row per changed field; a single row with field=null for create/plain actions.
 */
export async function recordAudit(
  executor: DbExecutor,
  entry: {
    userId: string;
    entityType: string;
    entityId: string;
    action: string;
    changes?: AuditChange[];
  },
): Promise<void> {
  const changes = entry.changes ?? [];
  const rows = (changes.length > 0 ? changes : [null]).map((c) => ({
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    field: c?.field ?? null,
    oldValue: c?.oldValue ?? null,
    newValue: c?.newValue ?? null,
  }));
  await executor.insert(auditLog).values(rows);
}
