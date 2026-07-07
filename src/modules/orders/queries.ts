import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, accounts, carriers, transportModes, auditLog, orderStatusEnum, payments, documents } from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";
import { paymentStatus, type PaymentStatus } from "@/lib/finance";
import { toCents } from "@/lib/money";
import type { OrderStatus } from "@/lib/order-status";

export type OrderListRow = {
  id: string;
  number: string;
  title: string;
  accountTitle: string;
  clientOrderId: string | null;
  route: string | null;
  transportNumber: string | null;
  weightKg: string | null;
  volumeM3: string | null;
  clientCharge: string | null;
  carrierCost: string | null;
  exchangeRate: string | null;
  status: OrderStatus;
  hasDocuments: boolean;
  /** Derived from amountReceivable vs incoming payments ("paid by customer"). */
  receivableStatus: PaymentStatus | null;
  /** Derived from amountPayable vs outgoing payments ("paid to carrier"). */
  payableStatus: PaymentStatus | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listOrders(opts: { q?: string; status?: string; page?: number; archived?: boolean }) {
  const page = Math.max(1, opts.page ?? 1);
  const conds = [opts.archived ? isNotNull(orders.deletedAt) : isNull(orders.deletedAt)];
  if (opts.status && (orderStatusEnum.enumValues as readonly string[]).includes(opts.status)) {
    conds.push(eq(orders.status, opts.status as OrderStatus));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(orders.number, like), ilike(orders.title, like), ilike(orders.route, like), ilike(accounts.title, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const incomingPaid = sql<string>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.direction} = 'incoming'), 0)`;
  const outgoingPaid = sql<string>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.direction} = 'outgoing'), 0)`;
  const hasDocs = sql<boolean>`exists(select 1 from ${documents} where ${documents.parentType} = 'order' and ${documents.parentId} = ${orders.id})`;

  const raw = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      accountTitle: accounts.title,
      clientOrderId: orders.clientOrderId,
      route: orders.route,
      transportNumber: transportModes.number,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      clientCharge: orders.clientCharge,
      carrierCost: orders.carrierCost,
      exchangeRate: orders.exchangeRate,
      status: orders.status,
      amountReceivable: orders.amountReceivable,
      amountPayable: orders.amountPayable,
      incomingPaid,
      outgoingPaid,
      hasDocuments: hasDocs,
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

  const rows: OrderListRow[] = raw.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    accountTitle: r.accountTitle,
    clientOrderId: r.clientOrderId,
    route: r.route,
    transportNumber: r.transportNumber,
    weightKg: r.weightKg,
    volumeM3: r.volumeM3,
    clientCharge: r.clientCharge,
    carrierCost: r.carrierCost,
    exchangeRate: r.exchangeRate,
    status: r.status,
    hasDocuments: r.hasDocuments,
    receivableStatus: paymentStatus(toCents(r.amountReceivable), toCents(r.incomingPaid)),
    payableStatus: paymentStatus(toCents(r.amountPayable), toCents(r.outgoingPaid)),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .where(where);

  return { rows, total, page };
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
    db.select({ id: accounts.id, title: accounts.title }).from(accounts).where(isNull(accounts.deletedAt)).orderBy(accounts.title).limit(1000),
    db.select({ id: carriers.id, title: carriers.title }).from(carriers).where(isNull(carriers.deletedAt)).orderBy(carriers.title).limit(1000),
  ]);
  return { accountOpts, carrierOpts };
}

export type ClientOrderListRow = {
  id: string;
  number: string;
  title: string;
  route: string | null;
  transportNumber: string | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** Orders belonging to one client account (portal My Orders), newest first. */
export async function listClientOrders(accountId: string, opts: { q?: string; status?: string }): Promise<ClientOrderListRow[]> {
  const conds = [eq(orders.accountId, accountId), isNull(orders.deletedAt)];
  if (opts.status && (orderStatusEnum.enumValues as readonly string[]).includes(opts.status)) {
    conds.push(eq(orders.status, opts.status as OrderStatus));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(orders.number, like), ilike(orders.title, like), ilike(orders.route, like))!);
  }
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      route: orders.route,
      transportNumber: transportModes.number,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(transportModes, eq(orders.transportModeId, transportModes.id))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt));
  return rows as ClientOrderListRow[];
}

/**
 * One order, but ONLY if it belongs to `accountId` (portal access guard).
 * Returns null when the order doesn't exist or isn't owned by this client.
 */
export async function getClientOrder(id: string, accountId: string) {
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
    .where(and(eq(orders.id, id), eq(orders.accountId, accountId), isNull(orders.deletedAt)))
    .limit(1);
  return row ?? null;
}
