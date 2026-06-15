import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contacts, orders } from "@/db/schema";

type SelectExecutor = Pick<typeof db, "select">;

export type OrderRecipients = { clientEmails: string[]; carrierEmails: string[] };

/** Collect notification emails for an order's account (client) and carrier contacts. */
export async function orderRecipients(tx: SelectExecutor, orderId: string): Promise<OrderRecipients> {
  const [order] = await tx
    .select({ accountId: orders.accountId, carrierId: orders.carrierId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { clientEmails: [], carrierEmails: [] };

  const ids = [order.accountId, order.carrierId].filter((v): v is string => Boolean(v));
  const rows = await tx
    .select({ parentType: contacts.parentType, parentId: contacts.parentId, emails: contacts.emails })
    .from(contacts)
    .where(inArray(contacts.parentId, ids));

  const client = new Set<string>();
  const carrier = new Set<string>();
  for (const r of rows) {
    const bucket =
      r.parentType === "account" && r.parentId === order.accountId
        ? client
        : r.parentType === "carrier" && r.parentId === order.carrierId
          ? carrier
          : null;
    if (!bucket) continue;
    for (const e of r.emails ?? []) if (e) bucket.add(e);
  }
  return { clientEmails: [...client], carrierEmails: [...carrier] };
}
