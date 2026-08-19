import {
  and, arrayContains, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql,
  type SQL, type SQLWrapper,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  orders,
  accounts,
  auditLog,
  cargoTypes,
  contacts,
  orderStatusEnum,
  modeTypeEnum,
  payments,
  documents,
  user,
  requests,
  quotations,
} from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";
import { paymentStatus, type PaymentStatus } from "@/lib/finance";
import { toCents } from "@/lib/money";
import type { OrderStatus } from "@/lib/order-status";
import type { TransportType } from "@/lib/transport-types";

// The carrier is an account too (role "carrier"); alias for joins next to the client.
const carrierAccounts = alias(accounts, "carrier_accounts");
// The audit-history join already uses `user`; the responsible manager needs its own.
const responsibleUsers = alias(user, "responsible_users");

const carrierOptsQuery = () =>
  db
    .select({ id: accounts.id, title: accounts.title })
    .from(accounts)
    .where(and(isNull(accounts.deletedAt), arrayContains(accounts.roles, ["carrier"])))
    .orderBy(accounts.title)
    .limit(1000);

// The client select mirrors the carrier one: only accounts holding the role.
const clientOptsQuery = () =>
  db
    .select({ id: accounts.id, title: accounts.title })
    .from(accounts)
    .where(and(isNull(accounts.deletedAt), arrayContains(accounts.roles, ["client"])))
    .orderBy(accounts.title)
    .limit(1000);

export type OrderListRow = {
  id: string;
  number: string;
  title: string;
  accountTitle: string;
  fromCountry: string | null;
  toCountry: string | null;
  transportType: TransportType | null;
  weightKg: string | null;
  volumeM3: string | null;
  currency: string;
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

export type OrderFilters = {
  q?: string;
  status?: string;
  page?: number;
  archived?: boolean;
  accountId?: string;
  carrierId?: string;
  from?: string;
  to?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Receivable payment status: paid | partly_paid | not_paid. */
  pay?: string;
  /** Payable payment status: paid | partly_paid | not_paid. */
  payTo?: string;
};

const incomingPaid = sql<string>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.direction} = 'incoming'), 0)`;
const outgoingPaid = sql<string>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.direction} = 'outgoing'), 0)`;

const PAY_STATUSES = ["paid", "partly_paid", "not_paid"] as const;

/**
 * SQL mirror of `paymentStatus()`: null invoiced (or ≤ 0) matches nothing, so a
 * filtered list never shows orders that haven't been invoiced on that side.
 */
function payStatusCond(invoiced: SQLWrapper, paid: SQLWrapper, status: string): SQL | undefined {
  if (!(PAY_STATUSES as readonly string[]).includes(status)) return undefined;
  if (status === "paid") return sql`${invoiced} > 0 and ${paid} >= ${invoiced}`;
  if (status === "not_paid") return sql`${invoiced} > 0 and ${paid} <= 0`;
  return sql`${invoiced} > 0 and ${paid} > 0 and ${paid} < ${invoiced}`;
}

function buildConditions(opts: OrderFilters): SQL[] {
  const conds: SQL[] = [
    (opts.archived ? isNotNull(orders.deletedAt) : isNull(orders.deletedAt)) as SQL,
  ];
  if (opts.status && (orderStatusEnum.enumValues as readonly string[]).includes(opts.status)) {
    conds.push(eq(orders.status, opts.status as OrderStatus));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(
      or(
        ilike(orders.number, like),
        ilike(orders.title, like),
        ilike(orders.fromCountry, like),
        ilike(orders.toCountry, like),
        ilike(accounts.title, like),
      )!,
    );
  }
  if (opts.accountId) conds.push(eq(orders.accountId, opts.accountId));
  if (opts.carrierId) conds.push(eq(orders.carrierId, opts.carrierId));
  if (opts.from) conds.push(eq(orders.fromCountry, opts.from));
  if (opts.to) conds.push(eq(orders.toCountry, opts.to));
  if (opts.type && (modeTypeEnum.enumValues as readonly string[]).includes(opts.type)) {
    conds.push(eq(orders.transportType, opts.type as TransportType));
  }
  if (opts.dateFrom) conds.push(gte(orders.createdAt, new Date(`${opts.dateFrom}T00:00:00Z`)));
  // Inclusive of the whole end day.
  if (opts.dateTo) conds.push(lte(orders.createdAt, new Date(`${opts.dateTo}T23:59:59.999Z`)));
  if (opts.pay) {
    const cond = payStatusCond(orders.amountReceivable, incomingPaid, opts.pay);
    if (cond) conds.push(cond);
  }
  if (opts.payTo) {
    const cond = payStatusCond(orders.amountPayable, outgoingPaid, opts.payTo);
    if (cond) conds.push(cond);
  }
  return conds;
}

export async function listOrders(opts: OrderFilters) {
  const page = Math.max(1, opts.page ?? 1);
  const where = and(...buildConditions(opts));

  const hasDocs = sql<boolean>`exists(select 1 from ${documents} where ${documents.parentType} = 'order' and ${documents.parentId} = ${orders.id})`;

  const raw = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      accountTitle: accounts.title,
      fromCountry: orders.fromCountry,
      toCountry: orders.toCountry,
      transportType: orders.transportType,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      currency: orders.currency,
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
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rows: OrderListRow[] = raw.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    accountTitle: r.accountTitle,
    fromCountry: r.fromCountry,
    toCountry: r.toCountry,
    transportType: r.transportType,
    weightKg: r.weightKg,
    volumeM3: r.volumeM3,
    currency: r.currency,
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

export type OrderHistoryEntry = {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  /** Who did it. Null for system actions or a since-deleted user. */
  userName: string | null;
};

export async function getOrder(id: string) {
  const [row] = await db
    .select({
      order: orders,
      accountTitle: accounts.title,
      carrierTitle: carrierAccounts.title,
      contactName: contacts.name,
      responsibleName: responsibleUsers.name,
      // Joined via requests.orderId so orders converted before orders.request_id
      // existed still show their source request.
      sourceRequestId: requests.id,
      sourceRequestNumber: requests.number,
      sourceQuotationVersion: quotations.version,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(carrierAccounts, eq(orders.carrierId, carrierAccounts.id))
    .leftJoin(contacts, eq(orders.contactId, contacts.id))
    .leftJoin(responsibleUsers, eq(orders.responsibleUserId, responsibleUsers.id))
    .leftJoin(requests, eq(requests.orderId, orders.id))
    .leftJoin(quotations, eq(orders.quotationId, quotations.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return null;

  const history: OrderHistoryEntry[] = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      field: auditLog.field,
      oldValue: auditLog.oldValue,
      newValue: auditLog.newValue,
      createdAt: auditLog.createdAt,
      userName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.userId, user.id))
    .where(and(eq(auditLog.entityType, "order"), eq(auditLog.entityId, id)))
    .orderBy(desc(auditLog.createdAt));

  return { ...row, history };
}

/** Dropdown data for the order form. */
export async function orderFormData() {
  const [accountOpts, carrierOpts, staffRows, cargoTypeRows] = await Promise.all([
    clientOptsQuery(),
    carrierOptsQuery(),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.active, true), inArray(user.role, ["admin", "operator", "supervisor"])))
      .orderBy(asc(user.name)),
    db
      .select({ title: cargoTypes.title })
      .from(cargoTypes)
      .where(isNull(cargoTypes.deletedAt))
      .orderBy(asc(cargoTypes.sortOrder), asc(cargoTypes.title)),
  ]);
  return {
    accountOpts,
    carrierOpts,
    staffOpts: staffRows.map((u) => ({ id: u.id, title: u.name })),
    // The description column stores the text itself, so value === label.
    cargoTypeOpts: cargoTypeRows.map((c) => ({ value: c.title, label: c.title })),
  };
}

/** Option lists for the orders-list filter bar. Countries are those actually in use. */
export async function orderFilterData() {
  const [accountOpts, carrierOpts, countryRows] = await Promise.all([
    clientOptsQuery(),
    carrierOptsQuery(),
    db
      .select({ code: sql<string>`c` })
      .from(
        sql`(select distinct ${orders.fromCountry} as c from ${orders} where ${orders.fromCountry} is not null
             union select distinct ${orders.toCountry} from ${orders} where ${orders.toCountry} is not null) t`,
      )
      .orderBy(sql`c`),
  ]);
  return { accountOpts, carrierOpts, countries: countryRows.map((r) => r.code) };
}

export type ClientOrderListRow = {
  id: string;
  number: string;
  title: string;
  fromCountry: string | null;
  toCountry: string | null;
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
    conds.push(or(ilike(orders.number, like), ilike(orders.title, like))!);
  }
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      fromCountry: orders.fromCountry,
      toCountry: orders.toCountry,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
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
      carrierTitle: carrierAccounts.title,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(carrierAccounts, eq(orders.carrierId, carrierAccounts.id))
    .where(and(eq(orders.id, id), eq(orders.accountId, accountId), isNull(orders.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Orders selectable when attaching a customs clearance. */
export async function orderPickerOptions() {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      accountId: orders.accountId,
      currency: orders.currency,
      exchangeRate: orders.exchangeRate,
    })
    .from(orders)
    .where(isNull(orders.deletedAt))
    .orderBy(asc(orders.number))
    .limit(1000);
}
