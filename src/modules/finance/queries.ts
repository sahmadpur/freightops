import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { accounts, carriers, orderFinanceLines, orders, payments, user } from "@/db/schema";
import {
  balance,
  bucketAging,
  daysOutstanding,
  expectedProfitCents,
  paymentStatus,
  settledProfitCents,
  type AgingBucket,
  type PaymentStatus,
} from "@/lib/finance";
import { convertToAzn, toCents } from "@/lib/money";
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

/** Payments are denominated in their order's currency; convert per payment. */
const paymentAzn = sql<string>`coalesce(sum(${payments.amount} * coalesce((select o.exchange_rate from ${orders} o where o.id = ${payments.orderId}), 1)), 0)`;

/** Excludes payments belonging to a soft-deleted (archived) order. */
const livePayment = sql`exists(select 1 from ${orders} o where o.id = ${payments.orderId} and o.deleted_at is null)`;

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
    periodTotals(from, to),
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
    topClientsByRevenue(from, to),
    monthlyResults(year),
  ]);

  return {
    month: selected,
    year,
    operational: {
      activeShipments: active,
      cargoInTransit: count("in_transit"),
      bookedWithCarrier: count("booked"),
      unfinishedOrders: count("delivered"),
      inOperations: count("operations"),
    },
    statusCounts: orderStatusList().map((s) => ({ status: s, count: count(s) })),
    financial: totals,
    /** All AZN-normalized, scoped to the selected month. */
    period: periodAgg,
    byTransportType: byType.map((r) => ({ transportType: r.transportType, count: r.count })),
    topRoutes: byRoute.map((r) => ({
      fromCountry: r.fromCountry,
      toCountry: r.toCountry,
      count: r.count,
    })),
    topClients: byClient,
    monthly,
  };
}

/**
 * Revenue / cost / profit for one period, AZN-normalized. Shared by the
 * Dashboard's "results for {month}" card and the Finance page's KPI row, so
 * the two can never disagree.
 */
export async function periodTotals(from: Date, to: Date) {
  const [agg] = await db
    .select({
      orders: sql<number>`count(*)`.mapWith(Number),
      revenue: azn(orders.clientCharge),
      carrierCost: azn(orders.carrierCost),
      settledProfit: aznSettled,
      unrated: sql<number>`count(*) filter (where ${orders.exchangeRate} is null and (${orders.clientCharge} is not null or ${orders.carrierCost} is not null))`.mapWith(Number),
    })
    .from(orders)
    .where(and(isNull(orders.deletedAt), gte(orders.createdAt, from), lt(orders.createdAt, to)));

  const revenueCents = toCents(agg?.revenue);
  const carrierCostCents = toCents(agg?.carrierCost);
  return {
    orders: agg?.orders ?? 0,
    revenueCents,
    carrierCostCents,
    expectedProfitCents: revenueCents - carrierCostCents,
    actualProfitCents: toCents(agg?.settledProfit),
    /** Orders carrying money but no FX rate — counted at face value. */
    unratedOrders: agg?.unrated ?? 0,
  };
}

/** Revenue / cost / profit per month for one calendar year, newest month first. */
export async function monthlyResults(year: number) {
  const rows = await db
    .select({
      month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
      revenue: azn(orders.clientCharge),
      carrierCost: azn(orders.carrierCost),
      settledProfit: aznSettled,
    })
    .from(orders)
    .where(and(sql`extract(year from ${orders.createdAt}) = ${year}`, isNull(orders.deletedAt)))
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
    .orderBy(desc(sql`to_char(${orders.createdAt}, 'YYYY-MM')`));

  return rows.map((m) => ({
    month: m.month,
    revenueCents: toCents(m.revenue),
    carrierCostCents: toCents(m.carrierCost),
    expectedProfitCents: toCents(m.revenue) - toCents(m.carrierCost),
    actualProfitCents: toCents(m.settledProfit),
  }));
}

/** The period's biggest clients by AZN revenue. */
export async function topClientsByRevenue(from: Date, to: Date, limit = 6) {
  const rows = await db
    .select({
      accountId: orders.accountId,
      accountTitle: accounts.title,
      revenue: azn(orders.clientCharge),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .where(and(isNull(orders.deletedAt), gte(orders.createdAt, from), lt(orders.createdAt, to)))
    .groupBy(orders.accountId, accounts.title)
    .orderBy(desc(azn(orders.clientCharge)))
    .limit(limit);

  return rows.map((r) => ({
    accountId: r.accountId,
    accountTitle: r.accountTitle,
    revenueCents: toCents(r.revenue),
    count: r.count,
  }));
}

/**
 * Money actually received vs paid per month of one calendar year, by payment
 * value date (not order date) — this is cash, not accrual. Newest month first,
 * to match `monthlyResults`.
 */
export async function cashFlowByMonth(year: number) {
  const monthExpr = sql<string>`to_char(${payments.paidAt}, 'YYYY-MM')`;
  const rows = await db
    .select({
      month: monthExpr,
      direction: payments.direction,
      total: paymentAzn,
    })
    .from(payments)
    .where(and(sql`extract(year from ${payments.paidAt}) = ${year}`, livePayment))
    .groupBy(monthExpr, payments.direction)
    .orderBy(desc(monthExpr));

  const byMonth = new Map<string, { receivedCents: number; paidCents: number }>();
  for (const r of rows) {
    const entry = byMonth.get(r.month) ?? { receivedCents: 0, paidCents: 0 };
    if (r.direction === "incoming") entry.receivedCents += toCents(r.total);
    else entry.paidCents += toCents(r.total);
    byMonth.set(r.month, entry);
  }

  return [...byMonth].map(([month, e]) => ({
    month,
    ...e,
    netCents: e.receivedCents - e.paidCents,
  }));
}

export type MixRow = { key: string; label: string | null; revenueCents: number; count: number };

/** Where the period's revenue comes from: by currency, and by transport type. */
export async function revenueMix(from: Date, to: Date) {
  const inPeriod = and(
    isNull(orders.deletedAt),
    gte(orders.createdAt, from),
    lt(orders.createdAt, to),
  );
  const [byCurrency, byType, byRoute] = await Promise.all([
    db
      .select({
        currency: orders.currency,
        revenue: azn(orders.clientCharge),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.currency)
      .orderBy(desc(azn(orders.clientCharge))),
    db
      .select({
        transportType: orders.transportType,
        revenue: azn(orders.clientCharge),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.transportType)
      .orderBy(desc(azn(orders.clientCharge))),
    db
      .select({
        fromCountry: orders.fromCountry,
        toCountry: orders.toCountry,
        margin: sql<string>`coalesce(sum((coalesce(${orders.clientCharge}, 0) - coalesce(${orders.carrierCost}, 0)) * coalesce(${orders.exchangeRate}, 1)), 0)`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(and(inPeriod, isNotNull(orders.fromCountry)))
      .groupBy(orders.fromCountry, orders.toCountry)
      .orderBy(desc(sql`sum((coalesce(${orders.clientCharge}, 0) - coalesce(${orders.carrierCost}, 0)) * coalesce(${orders.exchangeRate}, 1))`))
      .limit(6),
  ]);

  return {
    byCurrency: byCurrency.map((r) => ({
      currency: r.currency,
      revenueCents: toCents(r.revenue),
      count: r.count,
    })),
    byTransportType: byType.map((r) => ({
      transportType: r.transportType,
      revenueCents: toCents(r.revenue),
      count: r.count,
    })),
    byRoute: byRoute.map((r) => ({
      fromCountry: r.fromCountry,
      toCountry: r.toCountry,
      marginCents: toCents(r.margin),
      count: r.count,
    })),
  };
}

export type AgingSide = {
  buckets: { bucket: AgingBucket; cents: number; count: number }[];
  totalCents: number;
  /** The oldest unsettled orders on this side, worst first. */
  oldest: { id: string; number: string; title: string; days: number; cents: number }[];
};

/**
 * How old the outstanding money is, both sides. Built from the reconciliation
 * rows the Dashboard already loads rather than a second aggregate, so the
 * numbers agree with the report by construction. Receivables age from the
 * client invoice date, payables from the carrier invoice date; an order with
 * no invoice date yet ages from when it was created.
 */
export function agingFromRows(
  rows: ReconciliationRow[],
  now: Date,
): { receivable: AgingSide; payable: AgingSide } {
  const side = (pick: (r: ReconciliationRow) => { deltaCents: number; since: Date }): AgingSide => {
    const items = rows.map((r) => {
      const { deltaCents, since } = pick(r);
      // Face value when the order carries no FX rate — same rule as `azn()`.
      const cents = convertToAzn(deltaCents, r.exchangeRate) ?? deltaCents;
      return { row: r, cents, since, days: daysOutstanding(since, now) };
    });
    const { buckets, totalCents } = bucketAging(
      items.map((i) => ({ deltaCents: i.cents, since: i.since })),
      now,
    );
    return {
      buckets,
      totalCents,
      oldest: items
        .filter((i) => i.cents > 0)
        .sort((a, b) => b.days - a.days)
        .slice(0, 8)
        .map((i) => ({
          id: i.row.id,
          number: i.row.number,
          title: i.row.title,
          days: i.days,
          cents: i.cents,
        })),
    };
  };

  return {
    receivable: side((r) => ({
      deltaCents: r.receivable.deltaCents,
      since: r.invoiceDate ?? r.createdAt,
    })),
    payable: side((r) => ({
      deltaCents: r.payable.deltaCents,
      since: r.carrierInvoiceDate ?? r.createdAt,
    })),
  };
}

/**
 * Everything the Finance page draws, for one month (and its calendar year).
 * `monthRange()` resolves the period, so an absent or malformed `month` falls
 * back to the current one.
 */
export async function financeStats(month?: string) {
  const { from, to, month: selected } = monthRange(month);
  const year = from.getUTCFullYear();
  const now = new Date();

  const [totals, period, monthly, cashFlow, reconRows, topClients, mix] = await Promise.all([
    financeTotals(),
    periodTotals(from, to),
    monthlyResults(year),
    cashFlowByMonth(year),
    reconciliationRows(),
    topClientsByRevenue(from, to),
    revenueMix(from, to),
  ]);

  return {
    month: selected,
    year,
    totals,
    period,
    monthly,
    cashFlow,
    aging: agingFromRows(reconRows, now),
    topClients,
    mix,
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
  /** Client invoice date — the clock receivables age from. */
  invoiceDate: Date | null;
  /** Carrier invoice date — the clock payables age from. */
  carrierInvoiceDate: Date | null;
  createdAt: Date;
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
      invoiceDate: orders.invoiceDate,
      carrierInvoiceDate: orders.carrierInvoiceDate,
      createdAt: orders.createdAt,
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
      invoiceDate: r.invoiceDate ? new Date(r.invoiceDate) : null,
      carrierInvoiceDate: r.carrierInvoiceDate ? new Date(r.carrierInvoiceDate) : null,
      createdAt: r.createdAt,
      receivable: { ...recv, status: paymentStatus(recv.invoicedCents, recv.paidCents) },
      payable: { ...pay, status: paymentStatus(pay.invoicedCents, pay.paidCents) },
    };
  });
}

function orderStatusList(): OrderStatus[] {
  return Object.keys(ORDER_STATUS_RANK) as OrderStatus[];
}
