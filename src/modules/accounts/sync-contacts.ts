import { and, eq, inArray } from "drizzle-orm";
import { contacts } from "@/db/schema";
import type { db } from "@/db";
import type { ContactInput } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ParentType = "account" | "carrier";

/**
 * Reconcile a company's contacts against what the form submitted.
 *
 * Rows are matched by id and updated in place; ids the form no longer carries
 * are deleted; entries without an id are inserted. This keeps `contacts.id`
 * STABLE, which `requests.contact_id` depends on — the earlier delete-and-
 * reinsert would have silently orphaned every request's contact person on the
 * next edit of its company.
 *
 * Returns the contact names before and after, for the caller's audit diff.
 */
export async function syncContacts(
  tx: Tx,
  parentType: ParentType,
  parentId: string,
  incoming: ContactInput[],
): Promise<{ before: string[]; after: string[] }> {
  const scope = and(eq(contacts.parentType, parentType), eq(contacts.parentId, parentId));

  const existing = await tx
    .select({ id: contacts.id, name: contacts.name })
    .from(contacts)
    .where(scope)
    .orderBy(contacts.createdAt);
  const existingIds = new Set(existing.map((c) => c.id));

  const values = (c: ContactInput) => ({
    name: c.name,
    position: c.position || null,
    phones: c.phones,
    emails: c.emails,
    whatsapp: c.whatsapp || null,
    preferredChannel: c.preferredChannel || null,
    notes: c.notes || null,
  });

  // An id the form sent that no longer exists (concurrent delete) is treated as
  // a new contact rather than a lost one.
  const keep = incoming.filter((c) => c.id && existingIds.has(c.id));
  const add = incoming.filter((c) => !c.id || !existingIds.has(c.id));

  for (const c of keep) {
    await tx.update(contacts).set(values(c)).where(eq(contacts.id, c.id!));
  }

  const keptIds = new Set(keep.map((c) => c.id!));
  const removed = existing.filter((c) => !keptIds.has(c.id)).map((c) => c.id);
  if (removed.length > 0) {
    await tx.delete(contacts).where(and(scope, inArray(contacts.id, removed)));
  }

  if (add.length > 0) {
    await tx.insert(contacts).values(add.map((c) => ({ parentType, parentId, ...values(c) })));
  }

  return { before: existing.map((c) => c.name), after: incoming.map((c) => c.name) };
}

/** Delete every contact belonging to a company. No DB-level cascade exists. */
export async function deleteContactsOf(
  tx: Tx,
  parentType: ParentType,
  parentId: string,
): Promise<void> {
  await tx
    .delete(contacts)
    .where(and(eq(contacts.parentType, parentType), eq(contacts.parentId, parentId)));
}
