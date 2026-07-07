import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, carriers, orderFinanceLines, orders, payments } from "@/db/schema";
import { balance, expectedProfitCents, paymentStatus, settledProfitCents, type PaymentStatus } from "@/lib/finance";
import { toCents } from "@/lib/money";
import { ORDER_STATUS_RANK, type OrderStatus } from "@/lib/order-status";

export type OrderPayment = {
  id: string;
  direction: "incoming" | "outgoing";
  amount: string;
  paidAt: Date;
  note: string | null;
};

export type FinanceLine = {
  id: string;
  side: "revenue" | "cost";
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
  exchangeRate: string | null;
  amountReceivable: string | null;
  amountPayable: string | null;
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
    .select()
    .from(payments)
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
    exchangeRate: order.exchangeRate,
    amountReceivable: order.amountReceivable,
    amountPayable: order.amountPayable,
    revenueLines,
    costLines,
    receivable: { ...recv, status: paymentStatus(recv.invoicedCents, recv.paidCents) },
    payable: { ...pay, status: paymentStatus(pay.invoicedCents, pay.paidCents) },
    incoming,
    outgoing,
  };
}

/** Aggregate balances for the Finance page. All values in cents. */
export async function financeTotals() {
  // All aggregates exclude soft-deleted (archived) orders.
  const liveOrder = isNull(orders.deletedAt);
  const livePayment = sql`exists(select 1 from ${orders} o where o.id = ${payments.orderId} and o.deleted_at is null)`;
  const [recvAgg] = await db.select({ invoiced: sql<string>`coalesce(sum(${orders.amountReceivable}), 0)` }).from(orders).where(liveOrder);
  const [payAgg] = await db.select({ invoiced: sql<string>`coalesce(sum(${orders.amountPayable}), 0)` }).from(orders).where(liveOrder);
  const [inAgg] = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.direction, "incoming"), livePayment));
  const [outAgg] = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.direction, "outgoing"), livePayment));
  // YTD profit/revenue figures are scoped to the current calendar year; the
  // outstanding balances above are point-in-time and intentionally all-time.
  const year = new Date().getFullYear();
  const [revAgg] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${orders.clientCharge}), 0)`,
      carrierCost: sql<string>`coalesce(sum(${orders.carrierCost}), 0)`,
      // Settled (actual) profit = Σ(amountReceivable − amountPayable) — requirement #14.
      settledProfit: sql<string>`coalesce(sum(coalesce(${orders.amountReceivable}, 0) - coalesce(${orders.amountPayable}, 0)), 0)`,
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

/** Operational + financial aggregates for the Dashboard. */
export async function dashboardData() {
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

  const totals = await financeTotals();

  // Monthly results are scoped to the current year (matches the dashboard's year header).
  const year = new Date().getFullYear();
  const monthly = await db
    .select({
      month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
      revenue: sql<string>`coalesce(sum(${orders.clientCharge}), 0)`,
      carrierCost: sql<string>`coalesce(sum(${orders.carrierCost}), 0)`,
      settledProfit: sql<string>`coalesce(sum(coalesce(${orders.amountReceivable}, 0) - coalesce(${orders.amountPayable}, 0)), 0)`,
    })
    .from(orders)
    .where(and(sql`extract(year from ${orders.createdAt}) = ${year}`, isNull(orders.deletedAt)))
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
    .orderBy(desc(sql`to_char(${orders.createdAt}, 'YYYY-MM')`));

  return {
    operational: {
      activeShipments: active,
      cargoInTransit: count("transit"),
      atCustoms: count("at_customs"),
      unfinishedOrders: count("delivered"),
    },
    statusCounts: orderStatusList().map((s) => ({ status: s, count: count(s) })),
    financial: totals,
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
      exchangeRate: r.exchangeRate,
      receivable: { ...recv, status: paymentStatus(recv.invoicedCents, recv.paidCents) },
      payable: { ...pay, status: paymentStatus(pay.invoicedCents, pay.paidCents) },
    };
  });
}

function orderStatusList(): OrderStatus[] {
  return Object.keys(ORDER_STATUS_RANK) as OrderStatus[];
}
