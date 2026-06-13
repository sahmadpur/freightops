import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { actualProfitCents, balance, paymentStatus, type PaymentStatus } from "@/lib/finance";
import { toCents } from "@/lib/money";
import { ORDER_STATUS_RANK, type OrderStatus } from "@/lib/order-status";

export type OrderPayment = {
  id: string;
  direction: "incoming" | "outgoing";
  amount: string;
  paidAt: Date;
  note: string | null;
};

export type OrderFinance = {
  clientChargeCents: number;
  carrierCostCents: number;
  additionalCostsCents: number;
  actualProfitCents: number;
  amountReceivable: string | null;
  amountPayable: string | null;
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

  const recv = balance(order.amountReceivable, incoming.map((p) => p.amount));
  const pay = balance(order.amountPayable, outgoing.map((p) => p.amount));

  return {
    clientChargeCents: toCents(order.clientCharge),
    carrierCostCents: toCents(order.carrierCost),
    additionalCostsCents: toCents(order.additionalCosts),
    actualProfitCents: actualProfitCents(order.clientCharge, order.carrierCost, order.additionalCosts),
    amountReceivable: order.amountReceivable,
    amountPayable: order.amountPayable,
    receivable: { ...recv, status: paymentStatus(recv.invoicedCents, recv.paidCents) },
    payable: { ...pay, status: paymentStatus(pay.invoicedCents, pay.paidCents) },
    incoming,
    outgoing,
  };
}

/** Aggregate balances for the Finance page. All values in cents. */
export async function financeTotals() {
  const [recvAgg] = await db.select({ invoiced: sql<string>`coalesce(sum(${orders.amountReceivable}), 0)` }).from(orders);
  const [payAgg] = await db.select({ invoiced: sql<string>`coalesce(sum(${orders.amountPayable}), 0)` }).from(orders);
  const [inAgg] = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(eq(payments.direction, "incoming"));
  const [outAgg] = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(eq(payments.direction, "outgoing"));
  // YTD profit/revenue figures are scoped to the current calendar year; the
  // outstanding balances above are point-in-time and intentionally all-time.
  const year = new Date().getFullYear();
  const [revAgg] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${orders.clientCharge}), 0)`,
      carrierCost: sql<string>`coalesce(sum(${orders.carrierCost}), 0)`,
      additional: sql<string>`coalesce(sum(${orders.additionalCosts}), 0)`,
      expectedProfit: sql<string>`coalesce(sum(${orders.expectedProfit}), 0)`,
    })
    .from(orders)
    .where(sql`extract(year from ${orders.createdAt}) = ${year}`);

  const totalReceivable = toCents(recvAgg.invoiced);
  const totalPayable = toCents(payAgg.invoiced);
  const totalReceived = toCents(inAgg.total);
  const totalPaid = toCents(outAgg.total);
  const revenue = toCents(revAgg.revenue);
  const carrierCost = toCents(revAgg.carrierCost);
  const additional = toCents(revAgg.additional);
  const expectedProfit = toCents(revAgg.expectedProfit);

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
      additionalCents: additional,
      expectedProfitCents: expectedProfit,
      actualProfitCents: revenue - carrierCost - additional,
    },
  };
}

/** Operational + financial aggregates for the Dashboard. */
export async function dashboardData() {
  const statusRows = await db
    .select({ status: orders.status, count: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
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
      additional: sql<string>`coalesce(sum(${orders.additionalCosts}), 0)`,
      expectedProfit: sql<string>`coalesce(sum(${orders.expectedProfit}), 0)`,
    })
    .from(orders)
    .where(sql`extract(year from ${orders.createdAt}) = ${year}`)
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
      additionalCents: toCents(m.additional),
      expectedProfitCents: toCents(m.expectedProfit),
      actualProfitCents: toCents(m.revenue) - toCents(m.carrierCost) - toCents(m.additional),
    })),
  };
}

function orderStatusList(): OrderStatus[] {
  return Object.keys(ORDER_STATUS_RANK) as OrderStatus[];
}
