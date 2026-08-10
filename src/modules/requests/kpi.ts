import { and, gte, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { requests, user } from "@/db/schema";
import { monthRange } from "@/modules/finance/queries";

/**
 * The §22 KPI set, computed from the timestamps §23 requires to be stored from
 * day one. Nothing here is derived from a status alone: a request that was
 * quoted and later cancelled still counts in "quotation sent", because the work
 * was done.
 *
 * Requests are counted by when they were RECEIVED, not created, so a busy week
 * registered late still lands in the week it happened.
 */
export type ConversionBasis = "all" | "quoted";

export type RequestKpis = {
  month: string;
  total: number;
  quotationSent: number;
  won: number;
  lost: number;
  cancelled: number;
  open: number;
  /** Won ÷ total, and won ÷ quoted — the formula is switchable per §22. */
  conversionAll: number | null;
  conversionQuoted: number | null;
  bySource: { key: string; count: number }[];
  byManager: { key: string; label: string; count: number; won: number }[];
  lostReasons: { key: string; count: number }[];
  durations: DurationStat[];
};

/**
 * A duration KPI in hours. Median as well as mean, because one request that sat
 * unanswered over a holiday would otherwise drag the average into fiction.
 */
export type DurationStat = {
  key: "registration" | "timeToQuote" | "clientDecision" | "requestToOrder";
  meanHours: number | null;
  medianHours: number | null;
  samples: number;
};

const HOURS = sql`3600.0`;

/** Mean, median and sample count of a timestamp difference, over `where`. */
async function duration(
  key: DurationStat["key"],
  from: SQL,
  to: SQL,
  scope: SQL,
): Promise<DurationStat> {
  const delta = sql<number>`extract(epoch from (${to} - ${from})) / ${HOURS}`;
  const [row] = await db
    .select({
      mean: sql<number | null>`avg(${delta})`.mapWith(Number),
      median: sql<number | null>`percentile_cont(0.5) within group (order by ${delta})`.mapWith(Number),
      samples: sql<number>`count(*)`.mapWith(Number),
    })
    .from(requests)
    .where(and(scope, isNotNull(from), isNotNull(to)));
  return {
    key,
    meanHours: row.samples > 0 ? row.mean : null,
    medianHours: row.samples > 0 ? row.median : null,
    samples: row.samples,
  };
}

export async function requestKpis(month?: string): Promise<RequestKpis> {
  const { from, to, month: selected } = monthRange(month);
  // Archived requests are excluded, like everywhere else; a decided one is not
  // archived, so Won/Lost still count.
  const scope = and(
    isNull(requests.deletedAt),
    gte(requests.receivedAt, from),
    lt(requests.receivedAt, to),
  )!;

  const countOf = (extra?: SQL) =>
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(requests)
      .where(extra ? and(scope, extra) : scope)
      .then((r) => r[0].n);

  const [total, quotationSent, won, wonAfterQuote, lost, cancelled] = await Promise.all([
    countOf(),
    countOf(isNotNull(requests.quotationSentAt)),
    countOf(sql`${requests.status} = 'won'`),
    // Won *among the quoted*. A direct order never went through a quotation, so
    // counting it here would put the rate above 100% — which is how this was
    // caught. The two conversion figures answer different questions and need
    // different numerators.
    countOf(and(sql`${requests.status} = 'won'`, isNotNull(requests.quotationSentAt))!),
    countOf(sql`${requests.status} = 'lost'`),
    countOf(sql`${requests.status} = 'cancelled'`),
  ]);

  const [bySourceRows, byManagerRows, lostReasonRows] = await Promise.all([
    db
      .select({ key: requests.leadSource, count: sql<number>`count(*)`.mapWith(Number) })
      .from(requests)
      .where(scope)
      .groupBy(requests.leadSource)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        key: requests.responsibleUserId,
        label: user.name,
        count: sql<number>`count(*)`.mapWith(Number),
        won: sql<number>`count(*) filter (where ${requests.status} = 'won')`.mapWith(Number),
      })
      .from(requests)
      .leftJoin(user, sql`${user.id} = ${requests.responsibleUserId}`)
      .where(scope)
      .groupBy(requests.responsibleUserId, user.name)
      .orderBy(sql`count(*) desc`),
    db
      .select({ key: requests.lostReason, count: sql<number>`count(*)`.mapWith(Number) })
      .from(requests)
      .where(and(scope, isNotNull(requests.lostReason)))
      .groupBy(requests.lostReason)
      .orderBy(sql`count(*) desc`),
  ]);

  const durations = await Promise.all([
    duration("registration", requests.receivedAt.getSQL(), requests.createdAt.getSQL(), scope),
    duration("timeToQuote", requests.receivedAt.getSQL(), requests.quotationSentAt.getSQL(), scope),
    duration("clientDecision", requests.quotationSentAt.getSQL(), requests.decisionAt.getSQL(), scope),
    duration("requestToOrder", requests.receivedAt.getSQL(), requests.orderCreatedAt.getSQL(), scope),
  ]);

  return {
    month: selected,
    total,
    quotationSent,
    won,
    lost,
    cancelled,
    open: total - won - lost - cancelled,
    conversionAll: total > 0 ? (won / total) * 100 : null,
    // How well our offers land, ignoring the enquiries that never reached one.
    conversionQuoted: quotationSent > 0 ? (wonAfterQuote / quotationSent) * 100 : null,
    bySource: bySourceRows.map((r) => ({ key: r.key, count: r.count })),
    byManager: byManagerRows.map((r) => ({
      key: r.key,
      label: r.label ?? "—",
      count: r.count,
      won: r.won,
    })),
    lostReasons: lostReasonRows.map((r) => ({ key: r.key!, count: r.count })),
    durations,
  };
}
