import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  customsClearanceItems,
  customsClearances,
  orders,
} from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";
import { customsTotals } from "./totals";

export type CustomsListRow = {
  id: string;
  number: string;
  declarationNumber: string | null;
  description: string | null;
  orderNumber: string | null;
  accountTitle: string | null;
  currency: string;
  exchangeRate: string | null;
  clearedAt: string | null;
  buyCents: number;
  sellCents: number;
  marginCents: number;
  createdAt: Date;
};

export type CustomsItemRow = {
  id: string;
  category: string;
  buyAmount: string | null;
  sellAmount: string | null;
  note: string | null;
  sortOrder: number;
};

/**
 * Totals per clearance, computed in SQL so the list doesn't need to load every
 * item row. Mirrors `customsTotals` — keep the two in step.
 */
const buySum = sql<string>`coalesce((select sum(${customsClearanceItems.buyAmount}) from ${customsClearanceItems} where ${customsClearanceItems.clearanceId} = ${customsClearances.id}), 0)`;
const sellSum = sql<string>`coalesce((select sum(${customsClearanceItems.sellAmount}) from ${customsClearanceItems} where ${customsClearanceItems.clearanceId} = ${customsClearances.id}), 0)`;

export async function listCustomsClearances(opts: {
  q?: string;
  page?: number;
  archived?: boolean;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const conds: SQL[] = [
    (opts.archived ? isNotNull(customsClearances.deletedAt) : isNull(customsClearances.deletedAt)) as SQL,
  ];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(
      or(
        ilike(customsClearances.number, like),
        ilike(customsClearances.declarationNumber, like),
        ilike(customsClearances.description, like),
        ilike(orders.number, like),
        ilike(accounts.title, like),
      )!,
    );
  }
  const where = and(...conds);

  const raw = await db
    .select({
      id: customsClearances.id,
      number: customsClearances.number,
      declarationNumber: customsClearances.declarationNumber,
      description: customsClearances.description,
      orderNumber: orders.number,
      accountTitle: accounts.title,
      currency: customsClearances.currency,
      exchangeRate: customsClearances.exchangeRate,
      clearedAt: customsClearances.clearedAt,
      buy: buySum,
      sell: sellSum,
      createdAt: customsClearances.createdAt,
    })
    .from(customsClearances)
    .leftJoin(orders, eq(customsClearances.orderId, orders.id))
    .leftJoin(accounts, eq(customsClearances.accountId, accounts.id))
    .where(where)
    .orderBy(desc(customsClearances.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rows: CustomsListRow[] = raw.map((r) => {
    const totals = customsTotals([{ buyAmount: r.buy, sellAmount: r.sell }]);
    return {
      id: r.id,
      number: r.number,
      declarationNumber: r.declarationNumber,
      description: r.description,
      orderNumber: r.orderNumber,
      accountTitle: r.accountTitle,
      currency: r.currency,
      exchangeRate: r.exchangeRate,
      clearedAt: r.clearedAt,
      ...totals,
      createdAt: r.createdAt,
    };
  });

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(customsClearances)
    .leftJoin(orders, eq(customsClearances.orderId, orders.id))
    .leftJoin(accounts, eq(customsClearances.accountId, accounts.id))
    .where(where);

  return { rows, total, page };
}

export async function getCustomsClearance(id: string) {
  const [row] = await db
    .select({
      clearance: customsClearances,
      orderNumber: orders.number,
      orderTitle: orders.title,
      accountTitle: accounts.title,
    })
    .from(customsClearances)
    .leftJoin(orders, eq(customsClearances.orderId, orders.id))
    .leftJoin(accounts, eq(customsClearances.accountId, accounts.id))
    .where(eq(customsClearances.id, id))
    .limit(1);
  if (!row) return null;

  const items: CustomsItemRow[] = await db
    .select({
      id: customsClearanceItems.id,
      category: customsClearanceItems.category,
      buyAmount: customsClearanceItems.buyAmount,
      sellAmount: customsClearanceItems.sellAmount,
      note: customsClearanceItems.note,
      sortOrder: customsClearanceItems.sortOrder,
    })
    .from(customsClearanceItems)
    .where(eq(customsClearanceItems.clearanceId, id))
    .orderBy(asc(customsClearanceItems.sortOrder), asc(customsClearanceItems.createdAt));

  return { ...row, items, totals: customsTotals(items) };
}

/** Dropdown data for the customs form. */
export async function customsFormData() {
  const [accountOpts, orderOpts] = await Promise.all([
    db
      .select({ id: accounts.id, title: accounts.title })
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(accounts.title)
      .limit(1000),
    db
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
      .orderBy(desc(orders.createdAt))
      .limit(1000),
  ]);
  return { accountOpts, orderOpts };
}

/** Period totals for the dashboard's customs panel. */
export async function customsPeriodTotals(from: Date, to: Date) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      buy: sql<string>`coalesce(sum(${buySum}), 0)`,
      sell: sql<string>`coalesce(sum(${sellSum}), 0)`,
    })
    .from(customsClearances)
    .where(
      // gte/lt rather than a raw sql template: the driver needs the column's
      // type to bind a Date, and a raw parameter arrives as an unknown string.
      and(
        isNull(customsClearances.deletedAt),
        gte(customsClearances.createdAt, from),
        lt(customsClearances.createdAt, to),
      ),
    );
  const totals = customsTotals([{ buyAmount: row?.buy ?? "0", sellAmount: row?.sell ?? "0" }]);
  return { count: row?.count ?? 0, ...totals };
}
