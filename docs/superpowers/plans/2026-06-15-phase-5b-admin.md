# FreightOps Phase 5b — Admin (Users & Roles + Audit Log) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a Users & Roles page (list users, invite by email, change role, activate/deactivate, revoke pending invitations) and an Audit Log viewer (filterable, paginated), completing the FreightOps roadmap.

**Architecture:** Two pages under the existing admin area (`(staff)/admin/`, already gated by `requireArea("admin")`). User mutations are audited server actions guarded against admin self-lockout. Invitations reuse the existing `createInvitation` (which already emails the link) and `acceptInvitation` flow. The Audit Log reads the `audit_log` rows every prior phase already writes, joined to the actor.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM + Postgres 16, Better Auth (roles admin/operator/client), next-intl (en/ru/az), Vitest, Docker Compose. **No DB migration** (all tables/columns already exist).

---

## Context for the implementer (read before starting)

- **Admin area is already gated**: `src/app/(staff)/admin/layout.tsx` calls `await requireArea("admin")`. `admin/users/page.tsx` and `admin/audit/page.tsx` are placeholders to replace. The sidebar already links both (`nav.users`, `nav.audit`).
- **Auth/session**: `requireArea("admin")` (`src/lib/session.ts`) returns `{ session, role }`; `session.user` has `id, name, email, role, accountId, active`. Roles: `userRoleEnum.enumValues = ["admin","operator","client"]`. `getSession()` re-reads the user row, so a deactivated/role-changed user is reflected on their next request.
- **Invitations** (`src/lib/invitations.ts`): `createInvitation({ email, role, accountId?, invitedBy })` inserts the invite AND enqueues the invitation email in one tx; returns `{ token, url }`. `invitationStatus({ expiresAt, acceptedAt })` → `"valid"|"expired"|"used"`. `acceptInvitation` (already built) creates the user from a valid invite. The `invitations` table: `{ id, email, role, accountId, token, expiresAt, acceptedAt, invitedBy, createdAt }`.
- **Users** are the Better Auth `user` table (`src/db/schema/auth.ts`): `{ id, name, email, role, accountId, language, active, createdAt, ... }`. Update `role`/`active` directly via drizzle.
- **Audit** (`src/lib/audit.ts`): `recordAudit(tx, { userId, entityType, entityId, action, changes? })` writes one row per changed field (or a single field=null row) INSIDE the tx. `audit_log`: `{ id, userId, entityType, entityId, action, field, oldValue, newValue, createdAt }`, indexed on `(entityType, entityId)`.
- **Conventions**: every mutation action begins with `await requireArea("admin")`; audited mutations write `recordAudit(tx, …)` inside the same `db.transaction`. `ActionResult` (`src/lib/forms.ts`): `{ ok: true; id?: string } | { ok: false; error?: string; fieldErrors?: Record<string,string[]> }` (note: success may omit `id`). Client components value-import only server actions and `import type` everything from db-importing modules. Client handlers call `router.refresh()` after a successful action.
- **Hydration caveat** (learned in 5a): never render `new Date(x).toLocaleString()` in a **client** component without `<time suppressHydrationWarning>` (server TZ=UTC vs browser local). **Server components are not hydrated**, so dates rendered in a server component are safe — prefer rendering dates server-side.
- **Pagination**: `Paginator` + `PAGE_SIZE` (20) from `src/components/ui/paginator.tsx` (`<Paginator page total basePath params />`).
- **Form primitives**: `inputCls` from `src/components/ui/form`; `Card`/`CardHeader`/`CardBody` from `src/components/ui/card`. Mirror `src/modules/orders/status-control.tsx` for the client action-control pattern (useState + action + `router.refresh()`).
- **i18n**: `messages/{en,ru,az}.json`, 209 keys each, must stay at parity. `nav.users`/`nav.audit` exist (page titles). `fields.role`/`fields.name` do NOT exist — add what you need under a new `admin` namespace.

---

## File Structure

**Create:**
- `src/lib/user-guard.ts` + `src/lib/user-guard.test.ts` — pure `selfMutationBlocked(...)` self-lockout guard
- `src/modules/admin/queries.ts` — `listUsers`, `listInvitations`, `accountOptions`, `listAuditLog`, `distinctAuditEntityTypes`
- `src/modules/admin/schema.ts` — `inviteSchema`, `roleSchema`
- `src/modules/admin/actions.ts` — `inviteUser`, `setUserActive`, `setUserRole`, `revokeInvitation`
- `src/modules/admin/invite-user-form.tsx` — client invite form
- `src/modules/admin/users-table.tsx` — client users table (role select + active toggle)
- `src/modules/admin/invitations-list.tsx` — pending invitations + client `RevokeButton`

**Modify:**
- `src/app/(staff)/admin/users/page.tsx` — replace placeholder (Users & Roles)
- `src/app/(staff)/admin/audit/page.tsx` — replace placeholder (Audit Log viewer)
- `messages/{en,ru,az}.json` — add `admin` namespace

---

## Execution waves (for the controller)

- **Wave 1 (parallel, disjoint):** T1 (admin queries), T2 (guard + schema + actions), T3 (i18n)
- **Wave 2 (parallel):** T4 (Users page + components), T5 (Audit Log page)
- **Wave 3:** T6 (browser verification + phase close)

---

## Task 1: Admin queries

**Files:**
- Create: `src/modules/admin/queries.ts`

- [ ] **Step 1: Write the queries**

Create `src/modules/admin/queries.ts`:

```ts
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

/** All invitations, newest first (status is derived in the view via invitationStatus). */
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

/** Account id/title options for the invite form (client-role assignment). */
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

/** Distinct entity types present in the audit log (for the filter dropdown). */
export async function distinctAuditEntityTypes(): Promise<string[]> {
  const rows = await db.selectDistinct({ entityType: auditLog.entityType }).from(auditLog).orderBy(auditLog.entityType);
  return rows.map((r) => r.entityType);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep "admin/queries"` — must be empty (ignore concurrent-edit noise in other files).

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/queries.ts
git commit -m "feat(admin): users, invitations, and audit-log queries"
```

---

## Task 2: Self-lockout guard + invite schema + user-management actions

**Files:**
- Create: `src/lib/user-guard.ts`, `src/lib/user-guard.test.ts`, `src/modules/admin/schema.ts`, `src/modules/admin/actions.ts`

- [ ] **Step 1: Write the failing guard test**

Create `src/lib/user-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { selfMutationBlocked } from "./user-guard";

describe("selfMutationBlocked", () => {
  it("blocks deactivating yourself", () => {
    expect(selfMutationBlocked("u1", "u1", { active: false })).toBe(true);
  });
  it("blocks demoting yourself off admin", () => {
    expect(selfMutationBlocked("u1", "u1", { role: "operator" })).toBe(true);
    expect(selfMutationBlocked("u1", "u1", { role: "client" })).toBe(true);
  });
  it("allows keeping yourself admin / activating yourself", () => {
    expect(selfMutationBlocked("u1", "u1", { role: "admin" })).toBe(false);
    expect(selfMutationBlocked("u1", "u1", { active: true })).toBe(false);
  });
  it("never blocks actions on a different user", () => {
    expect(selfMutationBlocked("u1", "u2", { active: false })).toBe(false);
    expect(selfMutationBlocked("u1", "u2", { role: "client" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails** — `npx vitest run src/lib/user-guard.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the guard**

Create `src/lib/user-guard.ts`:

```ts
import type { Role } from "@/lib/roles";

/**
 * Prevent an admin from locking themselves out: an admin may not deactivate
 * their own account, nor demote themselves off the admin role.
 */
export function selfMutationBlocked(
  actorId: string,
  targetId: string,
  change: { active?: boolean; role?: Role },
): boolean {
  if (actorId !== targetId) return false;
  if (change.active === false) return true;
  if (change.role !== undefined && change.role !== "admin") return true;
  return false;
}
```

- [ ] **Step 4: Run the test, confirm it passes (4 tests).**

- [ ] **Step 5: Write the invite/role schemas**

Create `src/modules/admin/schema.ts`:

```ts
import { z } from "zod";
import { userRoleEnum } from "@/db/schema";

export const inviteSchema = z
  .object({
    email: z.string().trim().email(),
    role: z.enum(userRoleEnum.enumValues),
    accountId: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.role !== "client" || !!v.accountId, {
    message: "Client invitations require an account",
    path: ["accountId"],
  });
export type InviteInput = z.infer<typeof inviteSchema>;

export const roleSchema = z.object({ role: z.enum(userRoleEnum.enumValues) });
```

- [ ] **Step 6: Write the actions**

Create `src/modules/admin/actions.ts`:

```ts
"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { user, invitations } from "@/db/schema";
import { requireArea } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/forms";
import { createInvitation } from "@/lib/invitations";
import { selfMutationBlocked } from "@/lib/user-guard";
import { inviteSchema, roleSchema } from "./schema";

export async function inviteUser(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const existing = await db.query.user.findFirst({ where: eq(user.email, data.email) });
  if (existing) return { ok: false, error: "user_exists" };

  await createInvitation({
    email: data.email,
    role: data.role,
    accountId: data.accountId,
    invitedBy: session.user.id,
  });
  return { ok: true };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  if (selfMutationBlocked(session.user.id, userId, { active })) return { ok: false, error: "self_lockout" };

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.user.findFirst({ where: eq(user.id, userId) });
    if (!before) return "not_found" as const;
    if (before.active === active) return "ok" as const;
    await tx.update(user).set({ active }).where(eq(user.id, userId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "user",
      entityId: userId,
      action: active ? "user_activated" : "user_deactivated",
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function setUserRole(userId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("admin");
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_role" };
  const { role } = parsed.data;
  if (selfMutationBlocked(session.user.id, userId, { role })) return { ok: false, error: "self_lockout" };

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.user.findFirst({ where: eq(user.id, userId) });
    if (!before) return "not_found" as const;
    if (before.role === role) return "ok" as const;
    await tx.update(user).set({ role }).where(eq(user.id, userId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "user",
      entityId: userId,
      action: "user_role_changed",
      changes: [{ field: "role", oldValue: before.role, newValue: role }],
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true };
}

/** Revoke a still-pending (unaccepted) invitation. Accepted invites are kept as history. */
export async function revokeInvitation(id: string): Promise<ActionResult> {
  await requireArea("admin");
  await db.delete(invitations).where(and(eq(invitations.id, id), isNull(invitations.acceptedAt)));
  return { ok: true };
}
```

- [ ] **Step 7: Verify** — `npx vitest run src/lib/user-guard.test.ts` (4 pass); `npx tsc --noEmit --skipLibCheck 2>&1 | grep -iE "user-guard|admin/schema|admin/actions"` (fix errors in your files only).

- [ ] **Step 8: Commit**

```bash
git add src/lib/user-guard.ts src/lib/user-guard.test.ts src/modules/admin/schema.ts src/modules/admin/actions.ts
git commit -m "feat(admin): invite + role/active actions with self-lockout guard"
```

---

## Task 3: i18n — admin namespace

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`, `messages/az.json`

- [ ] **Step 1: Add an `admin` namespace to all three catalogs**

Add (translate per language; EN shown). Keep existing keys untouched.

`messages/en.json`:
```json
"admin": {
  "usersTitle": "Users & Roles",
  "inviteUser": "Invite user",
  "email": "Email",
  "name": "Name",
  "role": "Role",
  "account": "Account",
  "selectAccount": "Select account…",
  "status": "Status",
  "active": "Active",
  "inactive": "Inactive",
  "activate": "Activate",
  "deactivate": "Deactivate",
  "roleAdmin": "Admin",
  "roleOperator": "Operator",
  "roleClient": "Client",
  "sendInvite": "Send invitation",
  "inviteSent": "Invitation sent",
  "userExists": "A user with that email already exists",
  "selfLockout": "You cannot lock yourself out",
  "noUsers": "No users",
  "pendingInvitations": "Invitations",
  "invStatusValid": "Pending",
  "invStatusExpired": "Expired",
  "invStatusUsed": "Accepted",
  "revoke": "Revoke",
  "noInvitations": "No invitations",
  "auditTitle": "Audit Log",
  "auditTime": "Time",
  "auditActor": "Actor",
  "auditAction": "Action",
  "auditEntity": "Entity",
  "auditChange": "Change",
  "allTypes": "All types",
  "search": "Search",
  "filter": "Filter",
  "noAuditEntries": "No audit entries"
}
```

`messages/ru.json`:
```json
"admin": {
  "usersTitle": "Пользователи и роли",
  "inviteUser": "Пригласить пользователя",
  "email": "Эл. почта",
  "name": "Имя",
  "role": "Роль",
  "account": "Клиент",
  "selectAccount": "Выберите клиента…",
  "status": "Статус",
  "active": "Активен",
  "inactive": "Неактивен",
  "activate": "Активировать",
  "deactivate": "Деактивировать",
  "roleAdmin": "Администратор",
  "roleOperator": "Оператор",
  "roleClient": "Клиент",
  "sendInvite": "Отправить приглашение",
  "inviteSent": "Приглашение отправлено",
  "userExists": "Пользователь с такой почтой уже существует",
  "selfLockout": "Нельзя заблокировать самого себя",
  "noUsers": "Нет пользователей",
  "pendingInvitations": "Приглашения",
  "invStatusValid": "Ожидает",
  "invStatusExpired": "Истекло",
  "invStatusUsed": "Принято",
  "revoke": "Отозвать",
  "noInvitations": "Нет приглашений",
  "auditTitle": "Журнал аудита",
  "auditTime": "Время",
  "auditActor": "Автор",
  "auditAction": "Действие",
  "auditEntity": "Объект",
  "auditChange": "Изменение",
  "allTypes": "Все типы",
  "search": "Поиск",
  "filter": "Фильтр",
  "noAuditEntries": "Нет записей аудита"
}
```

`messages/az.json`:
```json
"admin": {
  "usersTitle": "İstifadəçilər və rollar",
  "inviteUser": "İstifadəçi dəvət et",
  "email": "E-poçt",
  "name": "Ad",
  "role": "Rol",
  "account": "Müştəri",
  "selectAccount": "Müştəri seçin…",
  "status": "Status",
  "active": "Aktiv",
  "inactive": "Qeyri-aktiv",
  "activate": "Aktivləşdir",
  "deactivate": "Deaktiv et",
  "roleAdmin": "Admin",
  "roleOperator": "Operator",
  "roleClient": "Müştəri",
  "sendInvite": "Dəvət göndər",
  "inviteSent": "Dəvət göndərildi",
  "userExists": "Bu e-poçtla istifadəçi artıq mövcuddur",
  "selfLockout": "Özünüzü bloklaya bilməzsiniz",
  "noUsers": "İstifadəçi yoxdur",
  "pendingInvitations": "Dəvətlər",
  "invStatusValid": "Gözləyir",
  "invStatusExpired": "Vaxtı bitib",
  "invStatusUsed": "Qəbul edilib",
  "revoke": "Ləğv et",
  "noInvitations": "Dəvət yoxdur",
  "auditTitle": "Audit jurnalı",
  "auditTime": "Vaxt",
  "auditActor": "Müəllif",
  "auditAction": "Əməliyyat",
  "auditEntity": "Obyekt",
  "auditChange": "Dəyişiklik",
  "allTypes": "Bütün tiplər",
  "search": "Axtarış",
  "filter": "Filtr",
  "noAuditEntries": "Audit qeydi yoxdur"
}
```

- [ ] **Step 2: Verify parity**

Run:
```bash
node -e "const a=require('./messages/en.json'),b=require('./messages/ru.json'),c=require('./messages/az.json');const k=o=>Object.keys(o).flatMap(x=>typeof o[x]==='object'&&o[x]!==null?Object.keys(o[x]).map(y=>x+'.'+y):[x]).sort();const ka=k(a),kb=k(b),kc=k(c);console.log('en',ka.length,'ru',kb.length,'az',kc.length);console.log('match', JSON.stringify(ka)===JSON.stringify(kb)&&JSON.stringify(kb)===JSON.stringify(kc));"
```
Expected: all three counts equal (whatever the number is) and `match true`.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/ru.json messages/az.json
git commit -m "i18n(admin): add admin namespace (en/ru/az)"
```

---

## Task 4: Users & Roles page

**Files:**
- Create: `src/modules/admin/invite-user-form.tsx`, `src/modules/admin/users-table.tsx`, `src/modules/admin/invitations-list.tsx`
- Modify: `src/app/(staff)/admin/users/page.tsx`

- [ ] **Step 1: Invite form (client component)**

Create `src/modules/admin/invite-user-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { inviteUser } from "./actions";

export function InviteUserForm({ accounts }: { accounts: { id: string; title: string }[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await inviteUser({ email, role, accountId: role === "client" ? accountId : undefined });
      if (r.ok) {
        setEmail("");
        setAccountId("");
        setMsg(t("inviteSent"));
        router.refresh();
      } else {
        setErr(r.error === "user_exists" ? t("userExists") : t("userExists"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-slate-500">{t("email")}</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs text-slate-500">{t("role")}</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="admin">{t("roleAdmin")}</option>
          <option value="operator">{t("roleOperator")}</option>
          <option value="client">{t("roleClient")}</option>
        </select>
      </div>
      {role === "client" && (
        <div>
          <label className="block text-xs text-slate-500">{t("account")}</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">{t("selectAccount")}</option>
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
          </select>
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !email || (role === "client" && !accountId)}
        className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {t("sendInvite")}
      </button>
      {msg && <span className="text-xs text-[#085041]">{msg}</span>}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Users table (client component)**

Create `src/modules/admin/users-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import type { UserRow } from "./queries";
import { setUserActive, setUserRole } from "./actions";

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changeRole(id: string, role: string) {
    setBusyId(id);
    try {
      const r = await setUserRole(id, { role });
      if (r.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }
  async function toggleActive(id: string, active: boolean) {
    setBusyId(id);
    try {
      const r = await setUserActive(id, active);
      if (r.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2">{t("name")}</th>
            <th className="px-4 py-2">{t("email")}</th>
            <th className="px-4 py-2">{t("role")}</th>
            <th className="px-4 py-2">{t("account")}</th>
            <th className="px-4 py-2">{t("status")}</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">
                  <select
                    value={u.role}
                    disabled={isSelf || busyId === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className={`${inputCls} w-auto`}
                  >
                    <option value="admin">{t("roleAdmin")}</option>
                    <option value="operator">{t("roleOperator")}</option>
                    <option value="client">{t("roleClient")}</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-slate-500">{u.accountTitle ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] ${u.active ? "bg-[#d4f2e7] text-[#085041]" : "bg-slate-200 text-slate-600"}`}>
                    {u.active ? t("active") : t("inactive")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    disabled={isSelf || busyId === u.id}
                    onClick={() => toggleActive(u.id, !u.active)}
                    className="text-xs text-[#1a3a5c] hover:underline disabled:opacity-40"
                  >
                    {u.active ? t("deactivate") : t("activate")}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Invitations list (server-rendered list + client revoke button)**

Create `src/modules/admin/invitations-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { revokeInvitation } from "./actions";

export function RevokeButton({ id }: { id: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await revokeInvitation(id);
          if (r.ok) router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="text-xs text-red-700 hover:underline disabled:opacity-40"
    >
      {t("revoke")}
    </button>
  );
}
```

- [ ] **Step 4: Build the Users page**

Replace `src/app/(staff)/admin/users/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { listUsers, listInvitations, accountOptions } from "@/modules/admin/queries";
import { invitationStatus } from "@/lib/invitations";
import { InviteUserForm } from "@/modules/admin/invite-user-form";
import { UsersTable } from "@/modules/admin/users-table";
import { RevokeButton } from "@/modules/admin/invitations-list";

export default async function UsersPage() {
  const { session } = await requireArea("admin");
  const t = await getTranslations("admin");
  const [users, invites, accounts] = await Promise.all([listUsers(), listInvitations(), accountOptions()]);

  const statusLabel: Record<string, string> = {
    valid: t("invStatusValid"),
    expired: t("invStatusExpired"),
    used: t("invStatusUsed"),
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">{t("usersTitle")}</h1>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("inviteUser")}</span></CardHeader>
        <CardBody><InviteUserForm accounts={accounts} /></CardBody>
      </Card>

      {users.length === 0 ? (
        <p className="text-sm text-slate-500">{t("noUsers")}</p>
      ) : (
        <UsersTable users={users} currentUserId={session.user.id} />
      )}

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("pendingInvitations")}</span></CardHeader>
        <CardBody>
          {invites.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noInvitations")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">{t("email")}</th>
                  <th className="py-1">{t("role")}</th>
                  <th className="py-1">{t("account")}</th>
                  <th className="py-1">{t("status")}</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const state = invitationStatus({ expiresAt: inv.expiresAt, acceptedAt: inv.acceptedAt });
                  return (
                    <tr key={inv.id} className="border-t border-slate-100">
                      <td className="py-1.5">{inv.email}</td>
                      <td className="py-1.5">{t(`role${inv.role.charAt(0).toUpperCase()}${inv.role.slice(1)}`)}</td>
                      <td className="py-1.5 text-slate-500">{inv.accountTitle ?? "—"}</td>
                      <td className="py-1.5 text-slate-500">{statusLabel[state]}</td>
                      <td className="py-1.5 text-right">{state === "valid" ? <RevokeButton id={inv.id} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

(The role label key uses `roleAdmin`/`roleOperator`/`roleClient` — the inline capitalization builds those keys from `inv.role`.)

- [ ] **Step 5: Type-check** — `npx tsc --noEmit --skipLibCheck 2>&1 | grep -iE "admin/(invite-user-form|users-table|invitations-list)|admin/users/page"` — fix errors in your files.

- [ ] **Step 6: Commit**

```bash
git add src/modules/admin/invite-user-form.tsx src/modules/admin/users-table.tsx src/modules/admin/invitations-list.tsx "src/app/(staff)/admin/users/page.tsx"
git commit -m "feat(admin): Users & Roles page (invite, role, activate, revoke)"
```

---

## Task 5: Audit Log viewer

**Files:**
- Modify: `src/app/(staff)/admin/audit/page.tsx`

- [ ] **Step 1: Build the audit page (server component; dates are safe to render here)**

Replace `src/app/(staff)/admin/audit/page.tsx`:

```tsx
import { getTranslations, getFormatter } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { Card, CardBody } from "@/components/ui/card";
import { Paginator } from "@/components/ui/paginator";
import { listAuditLog, distinctAuditEntityTypes } from "@/modules/admin/queries";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; q?: string; page?: string }>;
}) {
  await requireArea("admin");
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [{ rows, total }, types] = await Promise.all([
    listAuditLog({ entityType: sp.entityType, q: sp.q, page }),
    distinctAuditEntityTypes(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("auditTitle")}</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <select name="entityType" defaultValue={sp.entityType ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">{t("allTypes")}</option>
          {types.map((ty) => (<option key={ty} value={ty}>{ty}</option>))}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder={t("search")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm text-white">{t("filter")}</button>
      </form>

      <Card>
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noAuditEntries")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">{t("auditTime")}</th>
                  <th className="py-1">{t("auditActor")}</th>
                  <th className="py-1">{t("auditAction")}</th>
                  <th className="py-1">{t("auditEntity")}</th>
                  <th className="py-1">{t("auditChange")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 whitespace-nowrap text-slate-500">{format.dateTime(r.createdAt, { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="py-1.5">{r.actorName ?? r.actorEmail ?? "—"}</td>
                    <td className="py-1.5">{r.action}</td>
                    <td className="py-1.5 text-slate-500">{r.entityType} <span className="text-slate-300">·</span> <span className="font-mono text-[11px]">{r.entityId.slice(0, 8)}</span></td>
                    <td className="py-1.5 text-slate-600">
                      {r.field ? (
                        <span>{r.field}: <span className="text-slate-400">{r.oldValue ?? "∅"}</span> → {r.newValue ?? "∅"}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Paginator
            page={page}
            total={total}
            basePath="/admin/audit"
            params={{ ...(sp.entityType ? { entityType: sp.entityType } : {}), ...(sp.q ? { q: sp.q } : {}) }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
```

(`getFormatter().dateTime` renders consistently server-side — no hydration concern since this is a server component. Confirm `Card`/`CardBody` and `Paginator` import paths.)

- [ ] **Step 2: Type-check** — `npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "admin/audit/page"` — fix errors in this file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(staff)/admin/audit/page.tsx"
git commit -m "feat(admin): Audit Log viewer (filter + search + pagination)"
```

---

## Task 6: Phase close — browser verification + final gate

**Files:** none (verification + cleanup). Fix any i18n key / import mismatch found here in the owning task's file.

- [ ] **Step 1: Bring up the stack** — `docker compose up -d postgres minio mailpit app-dev`; confirm `http://localhost:3000/sign-in` 200.

- [ ] **Step 2: Browser verification (Playwright MCP), signed in as admin (`admin@freightops.local` / `admin12345`)**

1. Go to **Users & Roles** (`/admin/users`): the users list shows admin + operator (+ the seeded client if present) with role selects and active badges.
2. **Invite** an operator: enter an email, role Operator, send → "Invitation sent"; it appears under Invitations with status "Pending". In **Mailpit** (`http://localhost:8025`) the invitation email with the accept link is present.
3. **Invite a client**: choosing role Client reveals the Account select; sending without an account is blocked; with an account it succeeds.
4. **Change a role**: change the operator user to a different role → persists after refresh; an `user_role_changed` audit row is written.
5. **Deactivate** a non-self user → status flips to Inactive (`user_deactivated` audit). Re-activate works.
6. **Self-protection**: the admin's OWN row has the role select and Deactivate button disabled. (Optionally confirm the action also rejects server-side via the audit not changing.)
7. **Revoke** a pending invitation → it disappears.
8. Go to **Audit Log** (`/admin/audit`): entries render newest-first with actor, action, entity, and change (old→new for role changes); the entityType filter and the entityId search narrow results; pagination shows if >20 rows.
9. **Authorization**: as an **operator** (`op1@freightops.local`/`operatortest123`), navigate to `/admin/users` → redirected away (operators can't access the admin area). As a **client**, same.
10. RU locale: the admin pages localize (Пользователи и роли / Журнал аудита).

Optionally, complete the invite loop: copy the accept link from Mailpit, open it in a fresh context, set a password, and confirm the new user can sign in.

- [ ] **Step 3: Clean up** — delete any test invitations/users/audit rows you created beyond the intentional seed users; remove `.playwright-mcp`; sweep iCloud conflicts: `find . -name "* 2.*" -not -path "*/node_modules/*" -delete`.

- [ ] **Step 4: Final gate**

Run: `rm -rf .next && npx tsc --noEmit && npm run lint && npm test && npm run build && npx tsx --env-file=.env scripts/check-schema.mts`
Expected: tsc/lint clean; all tests pass; build succeeds; schema check **16 tables** (no migration).

- [ ] **Step 5: Commit the phase close (if anything pending)**

```bash
git add -A && (git diff --cached --quiet && echo "nothing to commit" || git commit -m "chore: close phase 5b — admin verified")
```

---

## Self-Review notes (author)

- **Spec coverage:** Users & Roles list (✓ T1/T4), invite by email with role + account (✓ T2 inviteUser → existing createInvitation which emails; T4 form), change role (✓ setUserRole, audited), activate/deactivate (✓ setUserActive, audited), revoke pending invitation (✓ revokeInvitation, unaccepted-only), Audit Log viewer with filter/search/pagination (✓ T1 listAuditLog + T5). Invitation accept loop already exists (`acceptInvitation`).
- **Authorization:** every action + both pages require the admin area (`requireArea("admin")`; the layout also gates). Self-lockout guard (`selfMutationBlocked`, TDD) blocks self-deactivation and self-demotion both in the UI (disabled controls) and server-side (action returns `self_lockout`).
- **Audit integrity:** user mutations write `recordAudit(tx, …)` inside the same transaction (entityType "user"); role change records the `role` field old→new; no-op changes short-circuit before writing (no false audit rows).
- **Hydration:** the audit table renders dates in a **server** component via `getFormatter().dateTime` (no client hydration) — safe. No client component renders raw locale dates.
- **Type consistency:** `UserRow`/`InvitationRow`/`AuditRow` shared via `import type`; `inviteSchema`/`roleSchema` use `userRoleEnum.enumValues`; `selfMutationBlocked(actorId, targetId, change)` arg order identical across test, guard, and both actions; `ActionResult` shape honored (success may omit `id`).
- **No migration:** uses existing `user`, `invitations`, `audit_log`, `accounts` tables. Schema check stays at 16 tables.
- **Deferred (documented):** changing a client user's assigned account after invite (set at invite time only); bulk actions; audit CSV export; "last admin" protection beyond self (self-guard covers the common footgun; a determined admin could still demote another admin — acceptable for v1). Transport-mode document UI and email localization remain deferred from earlier phases.
- **No placeholders:** every step has concrete code/commands; the only conditionals are explicit "confirm the import path / i18n key and adjust" checks tied to a scoped tsc/grep.
