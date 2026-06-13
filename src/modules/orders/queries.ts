import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, accounts, carriers, transportModes, auditLog, orderStatusEnum } from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";
import type { OrderStatus } from "@/lib/order-status";

export type OrderListRow = {
  id: string;
  number: string;
  title: string;
  accountTitle: string;
  route: string | null;
  transportNumber: string | null;
  clientCharge: string | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
};

export async function listOrders(opts: { q?: string; status?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const conds = [];
  if (opts.status && (orderStatusEnum.enumValues as readonly string[]).includes(opts.status)) {
    conds.push(eq(orders.status, opts.status as OrderStatus));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(orders.number, like), ilike(orders.title, like), ilike(orders.route, like), ilike(accounts.title, like)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      accountTitle: accounts.title,
      route: orders.route,
      transportNumber: transportModes.number,
      clientCharge: orders.clientCharge,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(transportModes, eq(orders.transportModeId, transportModes.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .where(where);

  return { rows: rows as OrderListRow[], total, page };
}

export async function getOrder(id: string) {
  const [row] = await db
    .select({
      order: orders,
      accountTitle: accounts.title,
      carrierTitle: carriers.title,
      transportNumber: transportModes.number,
      transportModeType: transportModes.modeType,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(carriers, eq(orders.carrierId, carriers.id))
    .leftJoin(transportModes, eq(orders.transportModeId, transportModes.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return null;

  const history = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, "order"), eq(auditLog.entityId, id)))
    .orderBy(desc(auditLog.createdAt));

  return { ...row, history };
}

/** Dropdown data for the order form. */
export async function orderFormData() {
  const [accountOpts, carrierOpts] = await Promise.all([
    db.select({ id: accounts.id, title: accounts.title }).from(accounts).orderBy(accounts.title).limit(1000),
    db.select({ id: carriers.id, title: carriers.title }).from(carriers).orderBy(carriers.title).limit(1000),
  ]);
  return { accountOpts, carrierOpts };
}
