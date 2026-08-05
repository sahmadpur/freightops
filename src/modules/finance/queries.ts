import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { accounts, carriers, orderFinanceLines, orders, payments, user } from "@/db/schema";
import { balance, expectedProfitCents, paymentStatus, settledProfitCents, type PaymentStatus } from "@/lib/finance";
import { toCents } from "@/lib/money";
import { ORDER_STATUS_RANK, type OrderStatus } from "@/lib/order-status";

export type OrderPayment = {
  id: string;
  direction: "incoming" | "outgoing";
  amount: string;
  paidAt: Date;
  note: string | null;
  /** Who entered it. Null for a since-deleted user. */
  recordedBy: string | null;
  createdAt: Date;
};

export type FinanceLine = {
  id: string;
  side: "revenue" | "cost";
  category: string;
  description: string;
  amount: string;
  note: string | null;
  sortOrder: number;
};

export type OrderFinance = {
  clientChargeCents: number;
  carrierCostCents: number;
  /** Expected (planned) profit = client charge − carrier cost. */
  expectedProfitCents: number;
  /** Actual (settled) profit = amount receivable − amount payable. */
  settledProfitCents: number;
  currency: string;
  exchangeRate: string | null;
  amountReceivable: string | null;
  amountPayable: string | null;
  carrierInvoiceNumber: string | null;
  carrierInvoiceDate: string | null;
  revenueLines: FinanceLine[];
  costLines: FinanceLine[];
  receivable: { invoicedCents: number; paidCents: number; deltaCents: number; status: PaymentStatus | null };
  payable: { invoicedCents: number; paidCents: number; deltaCents: number; status: PaymentStatus | null };
  incoming: OrderPayment[];
  outgoing: OrderPayment[];
};

/** Full financial picture for one order (Finance tab). Returns null if the order doesn't exist. */
export async function orderFinance(orderId: string): Promise<OrderFinance | null> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return null;

  const rows = await db
    .select({
      id: payments.id,
      direction: payments.direction,
      amount: payments.amount,
      paidAt: payments.paidAt,
      note: payments.note,
      createdAt: payments.createdAt,
      recordedBy: user.name,
    })
    .from(payments)
    .leftJoin(user, eq(payments.createdBy, user.id))
    .where(eq(payments.orderId, orderId))
    .orderBy(asc(payments.paidAt));

  const incoming = rows.filter((r) => r.direction === "incoming") as OrderPayment[];
  const outgoing = rows.filter((r) => r.direction === "outgoing") as OrderPayment[];

  const lineRows = await db
    .select()
    .from(orderFinanceLines)
    .where(eq(orderFinanceLines.orderId, orderId))
    .orderBy(asc(orderFinanceLines.sortOrder), asc(orderFinanceLines.createdAt));
  const revenueLines = lineRows.filter((l) => l.side === "revenue") as FinanceLine[];
  const costLines = lineRows.filter((l) => l.side === "cost") as FinanceLine[];

  const recv = balance(order.amountReceivable, incoming.map((p) => p.amount));
  const pay = balance(order.amountPayable, outgoing.map((p) => p.amount));

  return {
    clientChargeCents: toCents(order.clientCharge),
    carrierCostCents: toCents(order.carrierCost),
    expectedProfitCents: expectedProfitCents(order.clientCharge, order.carrierCost),
    settledProfitCents: settledProfitCents(order.amountReceivable, order.amountPayable),
    currency: order.currency,
    exchangeRate: order.exchangeRate,
    amountReceivable: order.amountReceivable,
    amountPayable: order.amountPayable,
    carrierInvoiceNumber: order.carrierInvoiceNumber,
    carrierInvoiceDate: order.carrierInvoiceDate,
    revenueLines,
    costLines,
    receivable: { ...recv, status: paymentStatus(recv.invoicedCents, recv.paidCents) },
    payable: { ...pay, status: paymentStatus(pay.invoicedCents, pay.paidCents) },
    incoming,
    outgoing,
  };
}

/**
 * Aggregate balances for the Finance page. All values in AZN cents: orders can
 * be quoted in five currencies, so every cross-order total is converted at each
 * order's own rate (see `azn` below).
 */
export async function financeTotals() {
  // All aggregates exclude soft-deleted (archived) orders.
  const liveOrder = isNull(orders.deletedAt);
  // Payments are denominated in their order's currency; convert per payment.
  const paymentAzn = sql<string>`coalesce(sum(${payments.amount} * coalesce((select o.exchange_rate from ${orders} o where o.id = ${payments.orderId}), 1)), 0)`;
  const livePayment = sql`exists(select 1 from ${orders} o where o.id = ${payments.orderId} and o.deleted_at is null)`;
  const [recvAgg] = await db.select({ invoiced: azn(orders.amountReceivable) }).from(orders).where(liveOrder);
  const [payAgg] = await db.select({ invoiced: azn(orders.amountPayable) }).from(orders).where(liveOrder);
  const [inAgg] = await db.select({ total: paymentAzn }).from(payments).where(and(eq(payments.direction, "incoming"), livePayment));
  const [outAgg] = await db.select({ total: paymentAzn }).from(payments).where(and(eq(payments.direction, "outgoing"), livePayment));
  // YTD profit/revenue figures are scoped to the current calendar year; the
  // outstanding balances above are point-in-time and intentionally all-time.
  const year = new Date().getFullYear();
  const [revAgg] = await db
    .select({
      revenue: azn(orders.clientCharge),
      carrierCost: azn(orders.carrierCost),
      // Settled (actual) profit = Σ(amountReceivable − amountPayable) — requirement #14.
      settledProfit: aznSettled,
    })
    .from(orders)
    .where(and(sql`extract(year from ${orders.createdAt}) = ${year}`, liveOrder));

  const totalReceivable = toCents(recvAgg.invoiced);
  const totalPayable = toCents(payAgg.invoiced);
  const totalReceived = toCents(inAgg.total);
  const totalPaid = toCents(outAgg.total);
  const revenue = toCents(revAgg.revenue);
  const carrierCost = toCents(revAgg.carrierCost);

  return {
    clients: {
      totalReceivableCents: totalReceivable,
      totalReceivedCents: totalReceived,
      outstandingCents: totalReceivable - totalReceived,
    },
    carriers: {
      totalPayableCents: totalPayable,
      totalPaidCents: totalPaid,
      outstandingCents: totalPayable - totalPaid,
    },
    ytd: {
      revenueCents: revenue,
      carrierCostsCents: carrierCost,
      // Expected (planned) profit = revenue − carrier cost.
      expectedProfitCents: revenue - carrierCost,
      // Actual (settled) profit = Σ(receivable − payable).
      actualProfitCents: toCents(revAgg.settledProfit),
    },
  };
}

/**
 * Money on an order converted to AZN at its own rate. Orders differ in currency
 * now, so AZN is the only denominator every aggregate can share. An order with
 * no rate is counted at face value — `unratedOrders` below reports how many, so
 * the UI can say the total is approximate rather than quietly misstating it.
 */
const azn = (col: AnyPgColumn) =>
  sql<string>`coalesce(sum(coalesce(${col}, 0) * coalesce(${orders.exchangeRate}, 1)), 0)`;

const aznSettled = sql<string>`coalesce(sum((coalesce(${orders.amountReceivable}, 0) - coalesce(${orders.amountPayable}, 0)) * coalesce(${orders.exchangeRate}, 1)), 0)`;

/** [start, end) for a YYYY-MM string; falls back to the current month. */
export function monthRange(month?: string): { from: Date; to: Date; month: string } {
  const now = new Date();
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : now.toISOString().slice(0, 7);
  const [y, mm] = m.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, mm - 1, 1)),
    to: new Date(Date.UTC(y, mm, 1)),
    month: m,
  };
}

/**
 * Operational + financial aggregates for the Dashboard, scoped to one month
 * (BRD 4.6). Operational counts and outstanding balances are deliberately
 * point-in-time — they describe the desk right now, not the selected period.
 */
export async function dashboardData(month?: string) {
  const { from, to, month: selected } = monthRange(month);
  const year = from.getUTCFullYear();
  const inPeriod = and(
    isNull(orders.deletedAt),
    gte(orders.createdAt, from),
    lt(orders.createdAt, to),
  );

  const statusRows = await db
    .select({ status: orders.status, count: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .where(isNull(orders.deletedAt))
    .groupBy(orders.status);

  const countByStatus = new Map<string, number>();
  for (const r of statusRows) countByStatus.set(r.status, r.count);
  const count = (s: OrderStatus) => countByStatus.get(s) ?? 0;

  const closedRanks = new Set([ORDER_STATUS_RANK.delivered, ORDER_STATUS_RANK.closed]);
  let active = 0;
  for (const [status, n] of countByStatus) {
    if (!closedRanks.has(ORDER_STATUS_RANK[status as OrderStatus])) active += n;
  }

  const [totals, periodAgg, byType, byRoute, byClient, monthly] = await Promise.all([
    financeTotals(),
    db
      .select({
        orders: sql<number>`count(*)`.mapWith(Number),
        revenue: azn(orders.clientCharge),
        carrierCost: azn(orders.carrierCost),
        settledProfit: aznSettled,
        unrated: sql<number>`count(*) filter (where ${orders.exchangeRate} is null and (${orders.clientCharge} is not null or ${orders.carrierCost} is not null))`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod),
    db
      .select({
        transportType: orders.transportType,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.transportType)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        fromCountry: orders.fromCountry,
        toCountry: orders.toCountry,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(and(inPeriod, isNotNull(orders.fromCountry)))
      .groupBy(orders.fromCountry, orders.toCountry)
      .orderBy(desc(sql`count(*)`))
      .limit(6),
    db
      .select({
        accountId: orders.accountId,
        accountTitle: accounts.title,
        revenue: azn(orders.clientCharge),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .innerJoin(accounts, eq(orders.accountId, accounts.id))
      .where(inPeriod)
      .groupBy(orders.accountId, accounts.title)
      .orderBy(desc(azn(orders.clientCharge)))
      .limit(6),
    db
      .select({
        month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        revenue: azn(orders.clientCharge),
        carrierCost: azn(orders.carrierCost),
        settledProfit: aznSettled,
      })
      .from(orders)
      .where(and(sql`extract(year from ${orders.createdAt}) = ${year}`, isNull(orders.deletedAt)))
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)),
  ]);

  const p = periodAgg[0];
  const periodRevenue = toCents(p?.revenue);
  const periodCost = toCents(p?.carrierCost);

  return {
    month: selected,
    year,
    operational: {
      activeShipments: active,
      cargoInTransit: count("transit"),
      atCustoms: count("at_customs"),
      unfinishedOrders: count("delivered"),
      awaitingPickup: count("waiting_pickup"),
    },
    statusCounts: orderStatusList().map((s) => ({ status: s, count: count(s) })),
    financial: totals,
    /** All AZN-normalized, scoped to the selected month. */
    period: {
      orders: p?.orders ?? 0,
      revenueCents: periodRevenue,
      carrierCostCents: periodCost,
      expectedProfitCents: periodRevenue - periodCost,
      actualProfitCents: toCents(p?.settledProfit),
      /** Orders carrying money but no FX rate — counted at face value. */
      unratedOrders: p?.unrated ?? 0,
    },
    byTransportType: byType.map((r) => ({ transportType: r.transportType, count: r.count })),
    topRoutes: byRoute.map((r) => ({
      fromCountry: r.fromCountry,
      toCountry: r.toCountry,
      count: r.count,
    })),
    topClients: byClient.map((r) => ({
      accountId: r.accountId,
      accountTitle: r.accountTitle,
      revenueCents: toCents(r.revenue),
      count: r.count,
    })),
    monthly: monthly.map((m) => ({
      month: m.month,
      revenueCents: toCents(m.revenue),
      carrierCostCents: toCents(m.carrierCost),
      expectedProfitCents: toCents(m.revenue) - toCents(m.carrierCost),
      actualProfitCents: toCents(m.settledProfit),
    })),
  };
}

export type ReconciliationSide = { invoicedCents: number; paidCents: number; deltaCents: number; status: PaymentStatus | null };
export type ReconciliationRow = {
  id: string;
  number: string;
  title: string;
  status: OrderStatus;
  accountTitle: string;
  carrierTitle: string | null;
  currency: string;
  exchangeRate: string | null;
  receivable: ReconciliationSide;
  payable: ReconciliationSide;
};

/** Per-order client-receivable / carrier-payable reconciliation rows (#15). */
export async function reconciliationRows(): Promise<ReconciliationRow[]> {
  const received = sql<string>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.direction} = 'incoming'), 0)`;
  const paid = sql<string>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.direction} = 'outgoing'), 0)`;
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      status: orders.status,
      accountTitle: accounts.title,
      carrierTitle: carriers.title,
      currency: orders.currency,
      exchangeRate: orders.exchangeRate,
      amountReceivable: orders.amountReceivable,
      amountPayable: orders.amountPayable,
      received,
      paid,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(carriers, eq(orders.carrierId, carriers.id))
    .where(isNull(orders.deletedAt))
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => {
    const recv = balance(r.amountReceivable, [r.received]);
    const pay = balance(r.amountPayable, [r.paid]);
    return {
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status,
      accountTitle: r.accountTitle,
      carrierTitle: r.carrierTitle,
      currency: r.currency,
      exchangeRate: r.exchangeRate,
      receivable: { ...recv, status: paymentStatus(recv.invoicedCents, recv.paidCents) },
      payable: { ...pay, status: paymentStatus(pay.invoicedCents, pay.paidCents) },
    };
  });
}

function orderStatusList(): OrderStatus[] {
  return Object.keys(ORDER_STATUS_RANK) as OrderStatus[];
}
