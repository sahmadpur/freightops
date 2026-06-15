import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { user, accounts, auditLog, invitations } from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  accountId: string | null;
  accountTitle: string | null;
};

/** All users with their (optional) client account, ordered by email. */
export async function listUsers(): Promise<UserRow[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      accountId: user.accountId,
      accountTitle: accounts.title,
    })
    .from(user)
    .leftJoin(accounts, eq(user.accountId, accounts.id))
    .orderBy(user.email);
}

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  accountTitle: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
};

/** All invitations, newest first. */
export async function listInvitations(): Promise<InvitationRow[]> {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      accountTitle: accounts.title,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .leftJoin(accounts, eq(invitations.accountId, accounts.id))
    .orderBy(desc(invitations.createdAt));
}

/** Account id/title options for the invite form. */
export async function accountOptions(): Promise<{ id: string; title: string }[]> {
  return db.select({ id: accounts.id, title: accounts.title }).from(accounts).orderBy(accounts.title).limit(1000);
}

export type AuditRow = {
  id: string;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

/** Paginated audit log, newest first, with optional entityType filter and entityId search. */
export async function listAuditLog(opts: { entityType?: string; q?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const conds = [];
  if (opts.entityType) conds.push(eq(auditLog.entityType, opts.entityType));
  if (opts.q) conds.push(ilike(auditLog.entityId, `%${opts.q}%`));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: auditLog.id,
      actorName: user.name,
      actorEmail: user.email,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      field: auditLog.field,
      oldValue: auditLog.oldValue,
      newValue: auditLog.newValue,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.userId, user.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLog)
    .where(where);

  return { rows: rows as AuditRow[], total, page };
}

/** Distinct entity types present in the audit log (filter dropdown). */
export async function distinctAuditEntityTypes(): Promise<string[]> {
  const rows = await db.selectDistinct({ entityType: auditLog.entityType }).from(auditLog).orderBy(auditLog.entityType);
  return rows.map((r) => r.entityType);
}
