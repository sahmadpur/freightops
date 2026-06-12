import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, contacts, orders } from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";

export type AccountListRow = {
  id: string;
  title: string;
  taxId: string | null;
  orderCount: number;
  contact1: { name: string; phone: string | null; email: string | null } | null;
  contact2Name: string | null;
};

export async function listAccounts(opts: { q?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.q ? ilike(accounts.title, `%${opts.q}%`) : undefined;

  const rows = await db
    .select({
      id: accounts.id,
      title: accounts.title,
      taxId: accounts.taxId,
      orderCount: sql<number>`(select count(*) from ${orders} o where o.account_id = ${accounts.id})`.mapWith(Number),
    })
    .from(accounts)
    .where(where)
    .orderBy(desc(accounts.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(accounts)
    .where(where);

  const ids = rows.map((r) => r.id);
  const contactRows = ids.length
    ? await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.parentType, "account"), inArray(contacts.parentId, ids)))
    : [];

  const byParent = new Map<string, typeof contactRows>();
  for (const c of contactRows) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  const result: AccountListRow[] = rows.map((r) => {
    const cs = byParent.get(r.id) ?? [];
    return {
      ...r,
      contact1: cs[0]
        ? { name: cs[0].name, phone: cs[0].phones[0] ?? null, email: cs[0].emails[0] ?? null }
        : null,
      contact2Name: cs[1]?.name ?? null,
    };
  });

  return { rows: result, total, page };
}

export async function getAccount(id: string) {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (!account) return null;
  const accountContacts = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.parentType, "account"), eq(contacts.parentId, id)))
    .orderBy(contacts.createdAt);
  const accountOrders = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.accountId, id))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  return { account, contacts: accountContacts, orders: accountOrders };
}
