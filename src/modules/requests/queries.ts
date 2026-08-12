import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  auditLog,
  contacts,
  leadSourceEnum,
  orders,
  requests,
  requestStatusEnum,
  transportFamilyEnum,
  transportLegs,
  user,
} from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";
import { readCargo, readLegs } from "./shipment";

export type RequestListRow = {
  id: string;
  number: string;
  title: string;
  accountTitle: string | null;
  leadSource: string;
  status: string;
  responsibleName: string | null;
  transportFamily: string | null;
  originCountry: string | null;
  originCity: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  receivedAt: Date;
  lastActivityAt: Date;
  orderId: string | null;
  orderNumber: string | null;
};

export type RequestFilters = {
  status?: string;
  leadSource?: string;
  responsibleUserId?: string;
  transportFamily?: string;
  accountId?: string;
  fromCountry?: string;
  toCountry?: string;
  dateFrom?: string;
  dateTo?: string;
};

/**
 * Route lives on the legs, so origin is the first leg's and destination the
 * last leg's. Correlated subqueries keep the list a single round trip and let
 * the country filters below reuse the exact same definition.
 */
const originLeg = (col: "origin_country" | "origin_city") =>
  sql<string | null>`(
    select l.${sql.raw(col)} from ${transportLegs} l
    where l.parent_type = 'request' and l.parent_id = ${requests.id}
    order by l.leg_number asc limit 1
  )`;

const destinationLeg = (col: "destination_country" | "destination_city") =>
  sql<string | null>`(
    select l.${sql.raw(col)} from ${transportLegs} l
    where l.parent_type = 'request' and l.parent_id = ${requests.id}
    order by l.leg_number desc limit 1
  )`;

/** The later of the row's own update and its most recent audit entry (§21). */
const lastActivity = sql<Date>`greatest(
  ${requests.updatedAt},
  coalesce((select max(a.created_at) from ${auditLog} a
            where a.entity_type = 'request' and a.entity_id = ${requests.id}), ${requests.updatedAt})
)`;

function buildConditions(opts: RequestFilters & { q?: string; archived?: boolean }): SQL[] {
  const conds: SQL[] = [];
  const archived = opts.archived ? isNotNull(requests.deletedAt) : isNull(requests.deletedAt);
  conds.push(archived);

  if (opts.q) {
    const like = `%${opts.q}%`;
    // Everything §21 asks global search to reach. Contact name/email and the
    // client title are joined in, so a search for "BOSCH" or for a person finds
    // the request without the user knowing which field it lives in.
    const match = or(
      ilike(requests.number, like),
      ilike(requests.title, like),
      ilike(requests.emailSubject, like),
      sql`exists (select 1 from ${accounts} ac where ac.id = ${requests.accountId} and ac.title ilike ${like})`,
      sql`exists (select 1 from ${contacts} c where c.id = ${requests.contactId}
                 and (c.name ilike ${like} or c.emails::text ilike ${like}))`,
      sql`exists (select 1 from ${orders} o where o.id = ${requests.orderId} and o.number ilike ${like})`,
      sql`exists (select 1 from ${transportLegs} l where l.parent_type = 'request' and l.parent_id = ${requests.id}
                 and (l.origin_city ilike ${like} or l.destination_city ilike ${like}
                      or l.origin_point ilike ${like} or l.destination_point ilike ${like}))`,
    );
    if (match) conds.push(match);
  }

  // Enum filters are checked against the enum before use — a hand-edited query
  // string must not reach the column as raw text.
  if (opts.status && (requestStatusEnum.enumValues as readonly string[]).includes(opts.status)) {
    conds.push(eq(requests.status, opts.status as (typeof requestStatusEnum.enumValues)[number]));
  }
  if (opts.leadSource && (leadSourceEnum.enumValues as readonly string[]).includes(opts.leadSource)) {
    conds.push(eq(requests.leadSource, opts.leadSource as (typeof leadSourceEnum.enumValues)[number]));
  }
  if (opts.transportFamily && (transportFamilyEnum.enumValues as readonly string[]).includes(opts.transportFamily)) {
    conds.push(
      eq(requests.transportFamily, opts.transportFamily as (typeof transportFamilyEnum.enumValues)[number]),
    );
  }
  if (opts.responsibleUserId) conds.push(eq(requests.responsibleUserId, opts.responsibleUserId));
  if (opts.accountId) conds.push(eq(requests.accountId, opts.accountId));
  if (opts.fromCountry) conds.push(sql`${originLeg("origin_country")} = ${opts.fromCountry}`);
  if (opts.toCountry) conds.push(sql`${destinationLeg("destination_country")} = ${opts.toCountry}`);
  if (opts.dateFrom) conds.push(gte(requests.receivedAt, new Date(`${opts.dateFrom}T00:00:00Z`)));
  if (opts.dateTo) conds.push(lte(requests.receivedAt, new Date(`${opts.dateTo}T23:59:59Z`)));

  return conds;
}

export async function listRequests(
  opts: RequestFilters & { q?: string; page?: number; archived?: boolean },
) {
  const page = Math.max(1, opts.page ?? 1);
  const where = and(...buildConditions(opts));

  const rows = await db
    .select({
      id: requests.id,
      number: requests.number,
      title: requests.title,
      accountTitle: accounts.title,
      leadSource: requests.leadSource,
      status: requests.status,
      responsibleName: user.name,
      transportFamily: requests.transportFamily,
      originCountry: originLeg("origin_country"),
      originCity: originLeg("origin_city"),
      destinationCountry: destinationLeg("destination_country"),
      destinationCity: destinationLeg("destination_city"),
      receivedAt: requests.receivedAt,
      lastActivityAt: lastActivity,
      orderId: requests.orderId,
      orderNumber: orders.number,
    })
    .from(requests)
    .leftJoin(accounts, eq(accounts.id, requests.accountId))
    .leftJoin(user, eq(user.id, requests.responsibleUserId))
    .leftJoin(orders, eq(orders.id, requests.orderId))
    .where(where)
    .orderBy(desc(requests.receivedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(requests)
    .where(where);

  return { rows: rows as RequestListRow[], total, page };
}

export type RequestHistoryEntry = {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  userName: string | null;
};

export async function getRequest(id: string) {
  const [row] = await db
    .select({
      request: requests,
      accountTitle: accounts.title,
      responsibleName: user.name,
      orderNumber: orders.number,
    })
    .from(requests)
    .leftJoin(accounts, eq(accounts.id, requests.accountId))
    .leftJoin(user, eq(user.id, requests.responsibleUserId))
    .leftJoin(orders, eq(orders.id, requests.orderId))
    .where(eq(requests.id, id))
    .limit(1);
  if (!row) return null;

  const [legs, cargo, contact, sourceAgent, history] = await Promise.all([
    readLegs(db, "request", id),
    readCargo(db, "request", id),
    row.request.contactId
      ? db.select().from(contacts).where(eq(contacts.id, row.request.contactId)).limit(1).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    row.request.sourceAgentAccountId
      ? db
          .select({ title: accounts.title })
          .from(accounts)
          .where(eq(accounts.id, row.request.sourceAgentAccountId))
          .limit(1)
          .then((r) => r[0]?.title ?? null)
      : Promise.resolve(null),
    db
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
      .leftJoin(user, eq(user.id, auditLog.userId))
      .where(and(eq(auditLog.entityType, "request"), eq(auditLog.entityId, id)))
      .orderBy(desc(auditLog.createdAt))
      .limit(200),
  ]);

  return {
    ...row,
    legs,
    cargo,
    contact,
    sourceAgentTitle: sourceAgent,
    history: history as RequestHistoryEntry[],
  };
}

/** Contacts belonging to one company — the Contact Person dropdown (§5). */
export async function contactOptions(accountId: string) {
  if (!accountId) return [];
  const rows = await db
    .select({ id: contacts.id, name: contacts.name, position: contacts.position })
    .from(contacts)
    .where(and(eq(contacts.parentType, "account"), eq(contacts.parentId, accountId)))
    .orderBy(asc(contacts.createdAt));
  return rows.map((c) => ({
    value: c.id,
    label: c.position ? `${c.name} — ${c.position}` : c.name,
  }));
}

/** Dropdown data for the request form. */
export async function requestFormData() {
  const [accountRows, staffRows] = await Promise.all([
    db
      .select({ id: accounts.id, title: accounts.title, roles: accounts.roles })
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.title)),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.active, true), inArray(user.role, ["admin", "operator", "supervisor"])))
      .orderBy(asc(user.name)),
  ]);
  return {
    accountOpts: accountRows.map((a) => ({ value: a.id, label: a.title })),
    agentOpts: accountRows
      .filter((a) => a.roles.includes("agent"))
      .map((a) => ({ value: a.id, label: a.title })),
    staffOpts: staffRows.map((u) => ({ value: u.id, label: u.name })),
  };
}

/** Dropdown data for the list filters, including only countries actually in use. */
export async function requestFilterData() {
  const [{ accountOpts, staffOpts }, countryRows] = await Promise.all([
    requestFormData(),
    db
      .selectDistinct({ country: transportLegs.originCountry })
      .from(transportLegs)
      .where(and(eq(transportLegs.parentType, "request"), isNotNull(transportLegs.originCountry))),
  ]);
  const destinationRows = await db
    .selectDistinct({ country: transportLegs.destinationCountry })
    .from(transportLegs)
    .where(and(eq(transportLegs.parentType, "request"), isNotNull(transportLegs.destinationCountry)));

  return {
    accountOpts,
    staffOpts,
    fromCountries: countryRows.map((r) => r.country!).filter(Boolean),
    toCountries: destinationRows.map((r) => r.country!).filter(Boolean),
  };
}
