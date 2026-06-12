# FreightOps Phase 2a — Entity Foundation (Accounts & Carriers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Accounts and Carriers placeholder pages with full CRUD (list, create, edit, profile view) including dynamic contacts ("+" rows), transactional audit logging, and the shared UI/i18n building blocks the Orders work (Phase 2b) will reuse.

**Architecture:** Feature modules under `src/modules/<entity>/` (zod schema + queries + server actions per entity); pages stay thin under `src/app/(staff)/`. Every mutation is a server action that re-checks the session (`requireArea`), validates with zod, and writes its audit entries **in the same drizzle transaction** as the change. Forms are client components with controlled state (no form library); create/edit are dedicated pages rather than the mock's modals so every state has a URL.

**Tech Stack:** Existing Phase 1 stack — Next.js 16 (App Router, server actions), Drizzle + Postgres, Better Auth (`requireArea`), next-intl, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-12-freightops-platform-design.md` §4 (modules 2, "accounts/carriers"), BRD §4.4. **Mock reference:** `docs/mock/freightops_mock.html` (Accounts/Carriers pages) — match its visual style (cards, tables, navy `#1a3a5c`).

**Out of scope (Phase 2b+):** Orders CRUD, order numbering, transport modes, Outstanding/balance columns (need payments — Phase 3), document counts, deleting entities (not in BRD; revisit if requested).

---

## Conventions (read first)

- **Dev environment:** `docker compose up -d` runs the app at `http://localhost:3000` with hot reload. Run one-off node commands either on the host (`npx tsx --env-file=.env ...`) or inside the container (`docker compose exec app-dev npx tsx ...`). Tests/lint/tsc run on the host (`npm test`, `npm run lint`, `npx tsc --noEmit`).
- **Server-action security:** every `"use server"` function begins with `await requireArea("staff")`. Layout guards do NOT protect actions — actions are network endpoints.
- **Audit:** every create/update calls `recordAudit` inside the same `db.transaction`. Field-level diffs for updates via `auditDiff`.
- **Money/qty:** drizzle `numeric` columns surface as `string | null` — never convert to JS floats.
- **Test users:** admin@freightops.local / admin12345 (admin), op1@freightops.local / operatortest123 (operator). Get a session cookie for curl checks with:

```bash
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"admin@freightops.local","password":"admin12345"}' | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)
```

- **Known accepted simplification:** server-side zod failures return zod's English `fieldErrors` displayed under fields; full localization of validation messages is deferred (tracked for Phase 5 polish). Labels and all chrome ARE translated.

## File map

```
src/lib/audit.ts                      recordAudit + auditDiff (+ test)
src/components/ui/card.tsx            Card, CardHeader, CardBody
src/components/ui/page-header.tsx     Title + action button row
src/components/ui/paginator.tsx       SearchParams-driven pagination links
src/components/ui/form.tsx            Field, inputCls, SubmitRow
src/components/ui/status-badge.tsx    Status pill (all 10 statuses; used from 2b on)
src/components/contacts-editor.tsx    Dynamic contacts with "+" phones/emails (shared)
src/modules/accounts/schema.ts        zod input schemas + types (+ test)
src/modules/accounts/queries.ts       listAccounts, getAccount
src/modules/accounts/actions.ts       createAccount, updateAccount (server actions)
src/modules/accounts/account-form.tsx client form component
src/modules/carriers/schema.ts        same shape, no taxId
src/modules/carriers/queries.ts
src/modules/carriers/actions.ts
src/modules/carriers/carrier-form.tsx
src/app/(staff)/accounts/page.tsx             list (replaces placeholder)
src/app/(staff)/accounts/new/page.tsx         create
src/app/(staff)/accounts/[id]/page.tsx        profile view
src/app/(staff)/accounts/[id]/edit/page.tsx   edit
src/app/(staff)/carriers/{page,new/page,[id]/page,[id]/edit/page}.tsx
messages/{en,ru,az}.json              new namespaces: actions, fields, accounts, carriers
```

---

### Task 1: Audit helper (TDD)

**Files:**
- Create: `src/lib/audit.ts`
- Test: `src/lib/audit.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/audit.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { auditDiff } from "./audit";

describe("auditDiff", () => {
  it("reports changed fields with stringified old/new values", () => {
    const changes = auditDiff(
      { title: "Old Co", taxId: 123 },
      { title: "New Co", taxId: 123 },
      ["title", "taxId"],
    );
    expect(changes).toEqual([{ field: "title", oldValue: "Old Co", newValue: "New Co" }]);
  });

  it("ignores fields not listed", () => {
    expect(auditDiff({ a: 1, b: 1 }, { a: 2, b: 2 }, ["a"])).toHaveLength(1);
  });

  it("treats null, undefined and empty string as the same null", () => {
    expect(auditDiff({ notes: null }, { notes: "" }, ["notes"])).toEqual([]);
    expect(auditDiff({ notes: undefined }, { notes: null }, ["notes"])).toEqual([]);
    expect(auditDiff({ notes: null }, { notes: "hi" }, ["notes"])).toEqual([
      { field: "notes", oldValue: null, newValue: "hi" },
    ]);
  });

  it("stringifies numbers", () => {
    expect(auditDiff({ weight: 100 }, { weight: 200 }, ["weight"])).toEqual([
      { field: "weight", oldValue: "100", newValue: "200" },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './audit'`

- [ ] **Step 3: Implement `src/lib/audit.ts`**

```ts
import { auditLog } from "@/db/schema";
import { db } from "@/db";

/** Works with both the root db and a transaction handle. */
export type DbExecutor = Pick<typeof db, "insert">;

export type AuditChange = { field: string; oldValue: string | null; newValue: string | null };

function normalize(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

/** Field-level diff between two records, restricted to `fields`. */
export function auditDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const oldValue = normalize(before[field]);
    const newValue = normalize(after[field]);
    if (oldValue !== newValue) changes.push({ field, oldValue, newValue });
  }
  return changes;
}

/**
 * Insert audit rows. MUST be called with the surrounding transaction handle
 * so history can never drift from the data (spec §3 "audit_log").
 * One row per changed field; a single row with field=null for create/plain actions.
 */
export async function recordAudit(
  executor: DbExecutor,
  entry: {
    userId: string;
    entityType: string;
    entityId: string;
    action: string;
    changes?: AuditChange[];
  },
): Promise<void> {
  const changes = entry.changes ?? [];
  const rows = (changes.length > 0 ? changes : [null]).map((c) => ({
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    field: c?.field ?? null,
    oldValue: c?.oldValue ?? null,
    newValue: c?.newValue ?? null,
  }));
  await executor.insert(auditLog).values(rows);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass (existing 13 + 4 new). Run `npx tsc --noEmit` → clean. (If `Pick<typeof db, "insert">` rejects the transaction handle when used in Task 4, switch to `type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];` — verify at that point, not now.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit.ts src/lib/audit.test.ts
git commit -m "feat: add transactional audit helper with field-level diffs"
```

---

### Task 2: Shared UI primitives

**Files:**
- Create: `src/components/ui/card.tsx`, `src/components/ui/page-header.tsx`, `src/components/ui/paginator.tsx`, `src/components/ui/form.tsx`, `src/components/ui/status-badge.tsx`

- [ ] **Step 1: `src/components/ui/card.tsx`**

```tsx
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}
```

- [ ] **Step 2: `src/components/ui/page-header.tsx`**

```tsx
export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      {action}
    </div>
  );
}
```

- [ ] **Step 3: `src/components/ui/paginator.tsx`** (server component; preserves other query params)

```tsx
import Link from "next/link";

export const PAGE_SIZE = 20;

export function Paginator({
  page,
  total,
  basePath,
  params = {},
}: {
  page: number;
  total: number;
  basePath: string;
  params?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams({ ...params, page: String(p) });
    return `${basePath}?${q.toString()}`;
  };

  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span>
        {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} / {total}
      </span>
      <div className="flex gap-1">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50">
            ‹
          </Link>
        )}
        <span className="rounded-md bg-[#1a3a5c] px-2.5 py-1 text-white">{page}</span>
        {page < pages && (
          <Link href={href(page + 1)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50">
            ›
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/ui/form.tsx`**

```tsx
export const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a3a5c] bg-white";

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-slate-500">
        {label}
      </label>
      {children}
      {error && error.length > 0 && <p className="mt-1 text-xs text-red-700">{error[0]}</p>}
    </div>
  );
}

export function SubmitRow({
  pending,
  saveLabel,
  cancelHref,
  cancelLabel,
}: {
  pending: boolean;
  saveLabel: string;
  cancelHref: string;
  cancelLabel: string;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <a href={cancelHref} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
        {cancelLabel}
      </a>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saveLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: `src/components/ui/status-badge.tsx`** (used from Phase 2b on; defined here so colors live with the other primitives)

```tsx
import { useTranslations } from "next-intl";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-[#ddeaf9] text-[#0c447c]",
  received: "bg-[#e3e0f7] text-[#3b2f7e]",
  internal_transit: "bg-[#d8eef7] text-[#0b4a63]",
  loaded: "bg-[#d4f2e7] text-[#085041]",
  transit: "bg-[#fdefd1] text-[#633806]",
  at_border: "bg-[#fde8df] text-[#712b13]",
  at_customs: "bg-[#fae0ea] text-[#72243e]",
  arrived: "bg-[#e0f0d0] text-[#27500a]",
  delivered: "bg-[#c8e8d8] text-[#085041]",
  closed: "bg-[#e8e8e8] text-[#444444]",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
        STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {t(status)}
    </span>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npm run lint` → clean (components are unused until Task 6; the linter must not flag that — if it does, proceed anyway, they're consumed two tasks later).

```bash
git add src/components/ui
git commit -m "feat: add shared ui primitives (card, page header, paginator, form, status badge)"
```

---

### Task 3: i18n catalog additions

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`, `messages/az.json`

- [ ] **Step 1: Add new namespaces to all three catalogs**

Add these top-level namespaces (keep existing `common`, `nav`, `status` untouched). `messages/en.json` additions:

```json
{
  "actions": {
    "new": "New",
    "edit": "Edit",
    "view": "View",
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back",
    "saving": "Saving..."
  },
  "fields": {
    "companyTitle": "Company title",
    "taxId": "Tax ID",
    "address": "Company address",
    "notes": "Comments / notes",
    "contacts": "Contacts",
    "contactName": "Name, surname",
    "phones": "Phones",
    "emails": "Emails",
    "addContact": "Add contact",
    "addPhone": "Add phone",
    "addEmail": "Add email",
    "remove": "Remove",
    "createdAt": "Created",
    "orders": "Orders",
    "orderHistory": "Order history",
    "noOrdersYet": "No orders yet",
    "actionsCol": "Actions"
  },
  "accounts": {
    "newAccount": "New account",
    "editAccount": "Edit account",
    "notFound": "Account not found",
    "searchPlaceholder": "Search accounts...",
    "empty": "No accounts yet — create the first one."
  },
  "carriers": {
    "newCarrier": "New carrier",
    "editCarrier": "Edit carrier",
    "notFound": "Carrier not found",
    "searchPlaceholder": "Search carriers...",
    "empty": "No carriers yet — create the first one."
  }
}
```

`messages/ru.json` additions:

```json
{
  "actions": {
    "new": "Создать",
    "edit": "Изменить",
    "view": "Просмотр",
    "save": "Сохранить",
    "cancel": "Отмена",
    "back": "Назад",
    "saving": "Сохранение..."
  },
  "fields": {
    "companyTitle": "Название компании",
    "taxId": "ИНН",
    "address": "Адрес компании",
    "notes": "Комментарии / заметки",
    "contacts": "Контакты",
    "contactName": "Имя, фамилия",
    "phones": "Телефоны",
    "emails": "Эл. почта",
    "addContact": "Добавить контакт",
    "addPhone": "Добавить телефон",
    "addEmail": "Добавить адрес",
    "remove": "Удалить",
    "createdAt": "Создано",
    "orders": "Заказы",
    "orderHistory": "История заказов",
    "noOrdersYet": "Заказов пока нет",
    "actionsCol": "Действия"
  },
  "accounts": {
    "newAccount": "Новый клиент",
    "editAccount": "Изменить клиента",
    "notFound": "Клиент не найден",
    "searchPlaceholder": "Поиск клиентов...",
    "empty": "Клиентов пока нет — создайте первого."
  },
  "carriers": {
    "newCarrier": "Новый перевозчик",
    "editCarrier": "Изменить перевозчика",
    "notFound": "Перевозчик не найден",
    "searchPlaceholder": "Поиск перевозчиков...",
    "empty": "Перевозчиков пока нет — создайте первого."
  }
}
```

`messages/az.json` additions:

```json
{
  "actions": {
    "new": "Yarat",
    "edit": "Redaktə et",
    "view": "Bax",
    "save": "Yadda saxla",
    "cancel": "Ləğv et",
    "back": "Geri",
    "saving": "Yadda saxlanılır..."
  },
  "fields": {
    "companyTitle": "Şirkətin adı",
    "taxId": "VÖEN",
    "address": "Şirkətin ünvanı",
    "notes": "Şərhlər / qeydlər",
    "contacts": "Əlaqələr",
    "contactName": "Ad, soyad",
    "phones": "Telefonlar",
    "emails": "E-poçt",
    "addContact": "Əlaqə əlavə et",
    "addPhone": "Telefon əlavə et",
    "addEmail": "E-poçt əlavə et",
    "remove": "Sil",
    "createdAt": "Yaradılıb",
    "orders": "Sifarişlər",
    "orderHistory": "Sifariş tarixçəsi",
    "noOrdersYet": "Hələ sifariş yoxdur",
    "actionsCol": "Əməliyyatlar"
  },
  "accounts": {
    "newAccount": "Yeni müştəri",
    "editAccount": "Müştərini redaktə et",
    "notFound": "Müştəri tapılmadı",
    "searchPlaceholder": "Müştəri axtar...",
    "empty": "Hələ müştəri yoxdur — birincisini yaradın."
  },
  "carriers": {
    "newCarrier": "Yeni daşıyıcı",
    "editCarrier": "Daşıyıcını redaktə et",
    "notFound": "Daşıyıcı tapılmadı",
    "searchPlaceholder": "Daşıyıcı axtar...",
    "empty": "Hələ daşıyıcı yoxdur — birincisini yaradın."
  }
}
```

- [ ] **Step 2: Verify key parity across the three catalogs**

```bash
for f in en ru az; do python3 -c "
import json,sys
d=json.load(open('messages/$f.json'))
def paths(o,p=''):
  for k,v in o.items():
    yield from paths(v,p+'.'+k) if isinstance(v,dict) else [p+'.'+k]
print('$f', len(sorted(paths(d))))
"; done
```

Expected: identical key counts for all three. Then `npm run build` → clean.

- [ ] **Step 3: Commit**

```bash
git add messages
git commit -m "feat: add entity/form i18n keys for en, ru, az"
```

---

### Task 4: Accounts module core (TDD on schema)

**Files:**
- Create: `src/modules/accounts/schema.ts`, `src/modules/accounts/queries.ts`, `src/modules/accounts/actions.ts`
- Test: `src/modules/accounts/schema.test.ts`

- [ ] **Step 1: Write the failing test `src/modules/accounts/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { accountInputSchema } from "./schema";

const valid = {
  title: "Baku Steel LLC",
  taxId: "1402556671",
  address: "Baku, Heydar Aliyev ave 1",
  notes: "",
  contacts: [{ name: "Elçin Məmməd", phones: ["+994501234567"], emails: ["elcin@bakusteel.az"] }],
};

describe("accountInputSchema", () => {
  it("accepts a valid account", () => {
    expect(accountInputSchema.safeParse(valid).success).toBe(true);
  });

  it("requires title", () => {
    const r = accountInputSchema.safeParse({ ...valid, title: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid contact emails", () => {
    const r = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ name: "X", phones: [], emails: ["not-an-email"] }],
    });
    expect(r.success).toBe(false);
  });

  it("allows zero contacts and trims empty phone/email entries", () => {
    const r = accountInputSchema.safeParse({ ...valid, contacts: [] });
    expect(r.success).toBe(true);
    const r2 = accountInputSchema.safeParse({
      ...valid,
      contacts: [{ name: "X", phones: ["  "], emails: [""] }],
    });
    expect(r2.success).toBe(true);
    if (r2.success) {
      expect(r2.data.contacts[0].phones).toEqual([]);
      expect(r2.data.contacts[0].emails).toEqual([]);
    }
  });

  it("caps contacts at 20 and phones/emails at 10 each", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `C${i}`, phones: [], emails: [] }));
    expect(accountInputSchema.safeParse({ ...valid, contacts: many }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` → FAIL (`Cannot find module './schema'`)

- [ ] **Step 3: Implement `src/modules/accounts/schema.ts`**

```ts
import { z } from "zod";

/** Drops whitespace-only entries, trims the rest. */
const trimmedList = (max: number, validate?: (s: z.ZodString) => z.ZodString) =>
  z
    .array(z.string())
    .max(max)
    .transform((arr) => arr.map((s) => s.trim()).filter((s) => s.length > 0))
    .pipe(z.array(validate ? validate(z.string()) : z.string().max(100)).max(max));

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phones: trimmedList(10, (s) => s.min(3).max(30)),
  emails: trimmedList(10, (s) => s.email().max(200)),
});

export const accountInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  taxId: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  contacts: z.array(contactInputSchema).max(20),
});

export type AccountInput = z.infer<typeof accountInputSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;

/** Shared shape for the form's typed result. */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass. (If the `trimmedList` transform/pipe combination fights the installed zod version, simplify to a `.transform()` followed by `.refine()` checks — the behavior under test is what matters.)

- [ ] **Step 5: Implement `src/modules/accounts/queries.ts`**

```ts
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, contacts, orders } from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";

export type AccountListRow = {
  id: string;
  title: string;
  taxId: string | null;
  orderCount: number;
  contact1: { name: string; phone: string | null; email: string | null } | null;
  contact2Name: string | null;
};

export async function listAccounts(opts: { q?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.q ? ilike(accounts.title, `%${opts.q}%`) : undefined;

  const rows = await db
    .select({
      id: accounts.id,
      title: accounts.title,
      taxId: accounts.taxId,
      orderCount: sql<number>`(select count(*) from ${orders} o where o.account_id = ${accounts.id})`.mapWith(Number),
    })
    .from(accounts)
    .where(where)
    .orderBy(desc(accounts.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(accounts)
    .where(where);

  const ids = rows.map((r) => r.id);
  const contactRows = ids.length
    ? await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.parentType, "account"), inArray(contacts.parentId, ids)))
    : [];

  const byParent = new Map<string, typeof contactRows>();
  for (const c of contactRows) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  const result: AccountListRow[] = rows.map((r) => {
    const cs = byParent.get(r.id) ?? [];
    return {
      ...r,
      contact1: cs[0]
        ? { name: cs[0].name, phone: cs[0].phones[0] ?? null, email: cs[0].emails[0] ?? null }
        : null,
      contact2Name: cs[1]?.name ?? null,
    };
  });

  return { rows: result, total, page };
}

export async function getAccount(id: string) {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (!account) return null;
  const accountContacts = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.parentType, "account"), eq(contacts.parentId, id)))
    .orderBy(contacts.createdAt);
  const accountOrders = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.accountId, id))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  return { account, contacts: accountContacts, orders: accountOrders };
}
```

- [ ] **Step 6: Implement `src/modules/accounts/actions.ts`**

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, contacts } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { accountInputSchema, type ActionResult } from "./schema";

const AUDITED_FIELDS = ["title", "taxId", "address", "notes"];

export async function createAccount(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(accounts)
      .values({
        title: data.title,
        taxId: data.taxId || null,
        address: data.address || null,
        notes: data.notes || null,
        createdBy: session.user.id,
      })
      .returning({ id: accounts.id });

    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "account" as const,
          parentId: row.id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "account",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function updateAccount(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const before = await db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (!before) return { ok: false, error: "not_found" };

  await db.transaction(async (tx) => {
    const after = {
      title: data.title,
      taxId: data.taxId || null,
      address: data.address || null,
      notes: data.notes || null,
    };
    await tx.update(accounts).set(after).where(eq(accounts.id, id));

    // Contacts: replace-all strategy (simple and audit-friendly for v1)
    await tx.delete(contacts).where(and(eq(contacts.parentType, "account"), eq(contacts.parentId, id)));
    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "account" as const,
          parentId: id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

    const changes = auditDiff(before, after, AUDITED_FIELDS);
    changes.push({
      field: "contacts",
      oldValue: null,
      newValue: data.contacts.map((c) => c.name).join(", ") || null,
    });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "account",
      entityId: id,
      action: "updated",
      changes,
    });
  });

  return { ok: true, id };
}
```

Note: the contacts audit entry always records the resulting contact list (replace-all makes a precise before/after diff disproportionate for v1). If `recordAudit(tx, ...)` fails typechecking because the transaction handle doesn't satisfy `DbExecutor`, apply the fallback type from Task 1 Step 4 in `src/lib/audit.ts`.

- [ ] **Step 7: Verify**

`npx tsc --noEmit && npm test && npm run lint` → clean. Then a real DB round-trip (uses the dockerized postgres):

```bash
npx tsx --env-file=.env -e "
import { db } from './src/db';
import { accounts, contacts, auditLog } from './src/db/schema';
import { eq } from 'drizzle-orm';
// exercise queries module only (actions need a session; they're exercised via the UI in Task 6)
import { listAccounts, getAccount } from './src/modules/accounts/queries';
const list = await listAccounts({});
console.log('listAccounts ok, total =', list.total);
process.exit(0);
"
```

Expected: `listAccounts ok, total = 0`

- [ ] **Step 8: Commit**

```bash
git add src/modules/accounts
git commit -m "feat: accounts module core — schema, queries, audited server actions"
```

---

### Task 5: ContactsEditor and AccountForm components

**Files:**
- Create: `src/components/contacts-editor.tsx`, `src/modules/accounts/account-form.tsx`

- [ ] **Step 1: `src/components/contacts-editor.tsx`** (client component; shared by accounts and carriers)

```tsx
"use client";

import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";

export type EditableContact = { name: string; phones: string[]; emails: string[] };

export function emptyContact(): EditableContact {
  return { name: "", phones: [""], emails: [""] };
}

export function ContactsEditor({
  contacts,
  onChange,
}: {
  contacts: EditableContact[];
  onChange: (next: EditableContact[]) => void;
}) {
  const t = useTranslations("fields");

  const update = (i: number, patch: Partial<EditableContact>) =>
    onChange(contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const updateList = (i: number, key: "phones" | "emails", j: number, value: string) =>
    update(i, { [key]: contacts[i][key].map((v, idx) => (idx === j ? value : v)) } as Partial<EditableContact>);

  const addToList = (i: number, key: "phones" | "emails") =>
    update(i, { [key]: [...contacts[i][key], ""] } as Partial<EditableContact>);

  return (
    <div className="space-y-3">
      {contacts.map((c, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {t("contacts")} {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(contacts.filter((_, idx) => idx !== i))}
              className="text-xs text-red-700 hover:underline"
            >
              {t("remove")}
            </button>
          </div>
          <input
            className={inputCls}
            placeholder={t("contactName")}
            value={c.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs text-slate-500">{t("phones")}</div>
              {c.phones.map((p, j) => (
                <input
                  key={j}
                  className={`${inputCls} mb-1.5`}
                  value={p}
                  onChange={(e) => updateList(i, "phones", j, e.target.value)}
                />
              ))}
              <button type="button" onClick={() => addToList(i, "phones")} className="text-xs text-[#1a3a5c] hover:underline">
                + {t("addPhone")}
              </button>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-500">{t("emails")}</div>
              {c.emails.map((m, j) => (
                <input
                  key={j}
                  type="email"
                  className={`${inputCls} mb-1.5`}
                  value={m}
                  onChange={(e) => updateList(i, "emails", j, e.target.value)}
                />
              ))}
              <button type="button" onClick={() => addToList(i, "emails")} className="text-xs text-[#1a3a5c] hover:underline">
                + {t("addEmail")}
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...contacts, emptyContact()])}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
      >
        + {t("addContact")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `src/modules/accounts/account-form.tsx`** (client; used by both new and edit pages)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { ContactsEditor, type EditableContact } from "@/components/contacts-editor";
import { createAccount, updateAccount } from "./actions";
import type { ActionResult } from "./schema";

export type AccountFormInitial = {
  id?: string;
  title: string;
  taxId: string;
  address: string;
  notes: string;
  contacts: EditableContact[];
};

export function AccountForm({ initial }: { initial: AccountFormInitial }) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [taxId, setTaxId] = useState(initial.taxId);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [contacts, setContacts] = useState<EditableContact[]>(initial.contacts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = { title, taxId, address, notes, contacts };
    const r = initial.id ? await updateAccount(initial.id, payload) : await createAccount(payload);
    setPending(false);
    setResult(r);
    if (r.ok) {
      router.push(`/accounts/${r.id}`);
      router.refresh();
    }
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Field label={t("fields.companyTitle")} htmlFor="title" error={fieldErrors.title}>
        <input id="title" required className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t("fields.taxId")} htmlFor="taxId" error={fieldErrors.taxId}>
        <input id="taxId" className={inputCls} value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      </Field>
      <Field label={t("fields.address")} htmlFor="address" error={fieldErrors.address}>
        <input id="address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label={t("fields.notes")} htmlFor="notes" error={fieldErrors.notes}>
        <textarea id="notes" rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label={t("fields.contacts")} error={fieldErrors.contacts}>
        <ContactsEditor contacts={contacts} onChange={setContacts} />
      </Field>
      {result && !result.ok && result.error && <p className="text-sm text-red-700">{result.error}</p>}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={initial.id ? `/accounts/${initial.id}` : "/accounts"}
        cancelLabel={t("actions.cancel")}
      />
    </form>
  );
}
```

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit && npm run lint` → clean.

```bash
git add src/components/contacts-editor.tsx src/modules/accounts/account-form.tsx
git commit -m "feat: contacts editor and account form components"
```

---

### Task 6: Accounts pages (list, new, view, edit)

**Files:**
- Modify: `src/app/(staff)/accounts/page.tsx` (replace placeholder)
- Create: `src/app/(staff)/accounts/new/page.tsx`, `src/app/(staff)/accounts/[id]/page.tsx`, `src/app/(staff)/accounts/[id]/edit/page.tsx`

- [ ] **Step 1: Replace `src/app/(staff)/accounts/page.tsx` with the list**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { listAccounts } from "@/modules/accounts/queries";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;
  const t = await getTranslations();
  const { rows, total } = await listAccounts({ q, page });

  return (
    <div>
      <PageHeader
        title={t("nav.accounts")}
        action={
          <Link
            href="/accounts/new"
            className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white"
          >
            + {t("accounts.newAccount")}
          </Link>
        }
      />
      <form className="mb-3" action="/accounts">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("accounts.searchPlaceholder")}
          className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3a5c]"
        />
      </form>
      <Card>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.companyTitle")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.taxId")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.contacts")} 1</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.contacts")} 2</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.phones")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.emails")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.orders")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.actionsCol")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3.5 py-8 text-center text-slate-400">
                  {t("accounts.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3.5 py-2.5 font-medium">{r.title}</td>
                <td className="px-3.5 py-2.5 text-slate-500">{r.taxId ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.name ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact2Name ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.phone ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.email ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.orderCount}</td>
                <td className="px-3.5 py-2.5">
                  <span className="flex gap-2 text-xs">
                    <Link className="text-[#1a3a5c] hover:underline" href={`/accounts/${r.id}`}>
                      {t("actions.view")}
                    </Link>
                    <Link className="text-[#1a3a5c] hover:underline" href={`/accounts/${r.id}/edit`}>
                      {t("actions.edit")}
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Paginator page={page} total={total} basePath="/accounts" params={q ? { q } : {}} />
    </div>
  );
}
```

- [ ] **Step 2: `src/app/(staff)/accounts/new/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { AccountForm } from "@/modules/accounts/account-form";

export default async function NewAccountPage() {
  const t = await getTranslations("accounts");
  return (
    <div>
      <PageHeader title={t("newAccount")} />
      <AccountForm initial={{ title: "", taxId: "", address: "", notes: "", contacts: [] }} />
    </div>
  );
}
```

- [ ] **Step 3: `src/app/(staff)/accounts/[id]/page.tsx`** (profile view)

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAccount } from "@/modules/accounts/queries";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await getAccount(id);
  if (!data) notFound();
  const { account, contacts, orders } = data;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={account.title}
        action={
          <Link
            href={`/accounts/${account.id}/edit`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("actions.edit")}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("nav.accounts")}</span>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">{t("fields.taxId")}</dt>
                <dd>{account.taxId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.address")}</dt>
                <dd>{account.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.notes")}</dt>
                <dd className="whitespace-pre-wrap">{account.notes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.createdAt")}</dt>
                <dd>{format.dateTime(account.createdAt, { dateStyle: "medium" })}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("fields.contacts")}</span>
          </CardHeader>
          <CardBody>
            {contacts.length === 0 && <p className="text-sm text-slate-400">—</p>}
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="font-medium">{c.name}</div>
                  {c.phones.length > 0 && <div className="text-slate-500">{c.phones.join(" · ")}</div>}
                  {c.emails.length > 0 && <div className="text-slate-500">{c.emails.join(" · ")}</div>}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <span className="text-sm font-semibold">{t("fields.orderHistory")}</span>
        </CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">{t("fields.noOrdersYet")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 first:border-0">
                    <td className="py-2 font-medium text-[#1a3a5c]">{o.number}</td>
                    <td className="py-2">{o.title}</td>
                    <td className="py-2">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2 text-slate-500">
                      {format.dateTime(o.createdAt, { dateStyle: "medium" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/(staff)/accounts/[id]/edit/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { AccountForm } from "@/modules/accounts/account-form";
import { getAccount } from "@/modules/accounts/queries";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("accounts");
  const data = await getAccount(id);
  if (!data) notFound();

  return (
    <div>
      <PageHeader title={t("editAccount")} />
      <AccountForm
        initial={{
          id: data.account.id,
          title: data.account.title,
          taxId: data.account.taxId ?? "",
          address: data.account.address ?? "",
          notes: data.account.notes ?? "",
          contacts: data.contacts.map((c) => ({
            name: c.name,
            phones: c.phones.length ? c.phones : [""],
            emails: c.emails.length ? c.emails : [""],
          })),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify end to end** (dockerized dev server must be up: `docker compose up -d`)

```bash
npx tsc --noEmit && npm test && npm run lint && npm run build
```

All clean. Then with the admin cookie (see Conventions):

1. `curl -s -H "Cookie: $COOKIE" http://localhost:3000/accounts | grep -c "New account"` → ≥1 (empty list renders).
2. In a browser (or note for the manual checklist): create "Baku Steel LLC" with tax ID + one contact with 2 phones; verify redirect to the profile page showing contact and "No orders yet"; edit it changing the title; verify list shows the new title.
   CLI alternative — server actions aren't curl-friendly, so verify the data layer end-to-end instead:

```bash
npx tsx --env-file=.env -e "
import { db } from './src/db';
import { accounts, contacts, auditLog, user } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { recordAudit, auditDiff } from './src/lib/audit';
// simulate exactly what createAccount does (minus the session check)
const admin = await db.query.user.findFirst();
const id = await db.transaction(async (tx) => {
  const [row] = await tx.insert(accounts).values({ title: 'Verify Co', createdBy: admin!.id }).returning({ id: accounts.id });
  await tx.insert(contacts).values({ parentType: 'account', parentId: row.id, name: 'Test Contact', phones: ['+994501112233'], emails: ['t@verify.co'] });
  await recordAudit(tx, { userId: admin!.id, entityType: 'account', entityId: row.id, action: 'created' });
  return row.id;
});
const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, id));
console.log('account created:', id, '| audit rows:', audits.length, '| action:', audits[0].action);
// cleanup
await db.delete(contacts).where(eq(contacts.parentId, id));
await db.delete(auditLog).where(eq(auditLog.entityId, id));
await db.delete(accounts).where(eq(accounts.id, id));
console.log('cleaned up');
process.exit(0);
"
```

Expected: `account created: <uuid> | audit rows: 1 | action: created` then `cleaned up`.

3. Browser-level smoke via curl: `curl -s -H "Cookie: $COOKIE" http://localhost:3000/accounts/new | grep -c "companyTitle\|Company title"` → ≥1.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(staff)/accounts"
git commit -m "feat: accounts list, create, profile, and edit pages"
```

---

### Task 7: Carriers module core

Carriers mirror accounts minus `taxId` (BRD §4.4). Full code repeated deliberately — do not import from the accounts module.

**Files:**
- Create: `src/modules/carriers/schema.ts`, `src/modules/carriers/queries.ts`, `src/modules/carriers/actions.ts`
- Test: `src/modules/carriers/schema.test.ts`

- [ ] **Step 1: Write the failing test `src/modules/carriers/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { carrierInputSchema } from "./schema";

const valid = {
  title: "Akın Logistics",
  address: "Istanbul",
  notes: "",
  contacts: [{ name: "Mehmet Akın", phones: ["+905324112387"], emails: ["ops@akinlogistics.com.tr"] }],
};

describe("carrierInputSchema", () => {
  it("accepts a valid carrier", () => {
    expect(carrierInputSchema.safeParse(valid).success).toBe(true);
  });
  it("requires title", () => {
    expect(carrierInputSchema.safeParse({ ...valid, title: " " }).success).toBe(false);
  });
  it("has no taxId field", () => {
    const r = carrierInputSchema.safeParse({ ...valid, taxId: "123" });
    expect(r.success).toBe(true);
    if (r.success) expect("taxId" in r.data).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement `src/modules/carriers/schema.ts`**

```ts
import { z } from "zod";
import { contactInputSchema, type ActionResult } from "@/modules/accounts/schema";

export { contactInputSchema };
export type { ActionResult };

export const carrierInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  contacts: z.array(contactInputSchema).max(20),
});

export type CarrierInput = z.infer<typeof carrierInputSchema>;
```

(`contactInputSchema` and `ActionResult` ARE shared — they're generic, not account-specific. Only the entity schemas stay separate.)

- [ ] **Step 4: Run tests to verify they pass** — `npm test` → all pass.

- [ ] **Step 5: Implement `src/modules/carriers/queries.ts`**

```ts
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { carriers, contacts, orders } from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";

export type CarrierListRow = {
  id: string;
  title: string;
  orderCount: number;
  contact1: { name: string; phone: string | null; email: string | null } | null;
  contact2Name: string | null;
};

export async function listCarriers(opts: { q?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.q ? ilike(carriers.title, `%${opts.q}%`) : undefined;

  const rows = await db
    .select({
      id: carriers.id,
      title: carriers.title,
      orderCount: sql<number>`(select count(*) from ${orders} o where o.carrier_id = ${carriers.id})`.mapWith(Number),
    })
    .from(carriers)
    .where(where)
    .orderBy(desc(carriers.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(carriers)
    .where(where);

  const ids = rows.map((r) => r.id);
  const contactRows = ids.length
    ? await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.parentType, "carrier"), inArray(contacts.parentId, ids)))
    : [];

  const byParent = new Map<string, typeof contactRows>();
  for (const c of contactRows) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  const result: CarrierListRow[] = rows.map((r) => {
    const cs = byParent.get(r.id) ?? [];
    return {
      ...r,
      contact1: cs[0]
        ? { name: cs[0].name, phone: cs[0].phones[0] ?? null, email: cs[0].emails[0] ?? null }
        : null,
      contact2Name: cs[1]?.name ?? null,
    };
  });

  return { rows: result, total, page };
}

export async function getCarrier(id: string) {
  const carrier = await db.query.carriers.findFirst({ where: eq(carriers.id, id) });
  if (!carrier) return null;
  const carrierContacts = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.parentType, "carrier"), eq(contacts.parentId, id)))
    .orderBy(contacts.createdAt);
  const carrierOrders = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.carrierId, id))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  return { carrier, contacts: carrierContacts, orders: carrierOrders };
}
```

- [ ] **Step 6: Implement `src/modules/carriers/actions.ts`**

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { carriers, contacts } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { carrierInputSchema } from "./schema";
import type { ActionResult } from "@/modules/accounts/schema";

const AUDITED_FIELDS = ["title", "address", "notes"];

export async function createCarrier(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = carrierInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(carriers)
      .values({
        title: data.title,
        address: data.address || null,
        notes: data.notes || null,
        createdBy: session.user.id,
      })
      .returning({ id: carriers.id });

    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "carrier" as const,
          parentId: row.id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "carrier",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function updateCarrier(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = carrierInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const before = await db.query.carriers.findFirst({ where: eq(carriers.id, id) });
  if (!before) return { ok: false, error: "not_found" };

  await db.transaction(async (tx) => {
    const after = {
      title: data.title,
      address: data.address || null,
      notes: data.notes || null,
    };
    await tx.update(carriers).set(after).where(eq(carriers.id, id));

    await tx.delete(contacts).where(and(eq(contacts.parentType, "carrier"), eq(contacts.parentId, id)));
    if (data.contacts.length > 0) {
      await tx.insert(contacts).values(
        data.contacts.map((c) => ({
          parentType: "carrier" as const,
          parentId: id,
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        })),
      );
    }

    const changes = auditDiff(before, after, AUDITED_FIELDS);
    changes.push({
      field: "contacts",
      oldValue: null,
      newValue: data.contacts.map((c) => c.name).join(", ") || null,
    });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "carrier",
      entityId: id,
      action: "updated",
      changes,
    });
  });

  return { ok: true, id };
}
```

- [ ] **Step 7: Verify** — `npx tsc --noEmit && npm test && npm run lint` → clean.

- [ ] **Step 8: Commit**

```bash
git add src/modules/carriers
git commit -m "feat: carriers module core — schema, queries, audited server actions"
```

---

### Task 8: Carriers form and pages

**Files:**
- Create: `src/modules/carriers/carrier-form.tsx`, `src/app/(staff)/carriers/new/page.tsx`, `src/app/(staff)/carriers/[id]/page.tsx`, `src/app/(staff)/carriers/[id]/edit/page.tsx`
- Modify: `src/app/(staff)/carriers/page.tsx` (replace placeholder)

- [ ] **Step 1: `src/modules/carriers/carrier-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { ContactsEditor, type EditableContact } from "@/components/contacts-editor";
import { createCarrier, updateCarrier } from "./actions";
import type { ActionResult } from "@/modules/accounts/schema";

export type CarrierFormInitial = {
  id?: string;
  title: string;
  address: string;
  notes: string;
  contacts: EditableContact[];
};

export function CarrierForm({ initial }: { initial: CarrierFormInitial }) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [contacts, setContacts] = useState<EditableContact[]>(initial.contacts);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = { title, address, notes, contacts };
    const r = initial.id ? await updateCarrier(initial.id, payload) : await createCarrier(payload);
    setPending(false);
    setResult(r);
    if (r.ok) {
      router.push(`/carriers/${r.id}`);
      router.refresh();
    }
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Field label={t("fields.companyTitle")} htmlFor="title" error={fieldErrors.title}>
        <input id="title" required className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t("fields.address")} htmlFor="address" error={fieldErrors.address}>
        <input id="address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label={t("fields.notes")} htmlFor="notes" error={fieldErrors.notes}>
        <textarea id="notes" rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label={t("fields.contacts")} error={fieldErrors.contacts}>
        <ContactsEditor contacts={contacts} onChange={setContacts} />
      </Field>
      {result && !result.ok && result.error && <p className="text-sm text-red-700">{result.error}</p>}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={initial.id ? `/carriers/${initial.id}` : "/carriers"}
        cancelLabel={t("actions.cancel")}
      />
    </form>
  );
}
```

- [ ] **Step 2: Replace `src/app/(staff)/carriers/page.tsx` with the list**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { listCarriers } from "@/modules/carriers/queries";

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;
  const t = await getTranslations();
  const { rows, total } = await listCarriers({ q, page });

  return (
    <div>
      <PageHeader
        title={t("nav.carriers")}
        action={
          <Link
            href="/carriers/new"
            className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white"
          >
            + {t("carriers.newCarrier")}
          </Link>
        }
      />
      <form className="mb-3" action="/carriers">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("carriers.searchPlaceholder")}
          className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3a5c]"
        />
      </form>
      <Card>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.companyTitle")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.contacts")} 1</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.contacts")} 2</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.phones")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.emails")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.orders")}</th>
              <th className="px-3.5 py-2.5 font-semibold">{t("fields.actionsCol")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3.5 py-8 text-center text-slate-400">
                  {t("carriers.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3.5 py-2.5 font-medium">{r.title}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.name ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact2Name ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.phone ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.contact1?.email ?? "—"}</td>
                <td className="px-3.5 py-2.5">{r.orderCount}</td>
                <td className="px-3.5 py-2.5">
                  <span className="flex gap-2 text-xs">
                    <Link className="text-[#1a3a5c] hover:underline" href={`/carriers/${r.id}`}>
                      {t("actions.view")}
                    </Link>
                    <Link className="text-[#1a3a5c] hover:underline" href={`/carriers/${r.id}/edit`}>
                      {t("actions.edit")}
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Paginator page={page} total={total} basePath="/carriers" params={q ? { q } : {}} />
    </div>
  );
}
```

- [ ] **Step 3: `src/app/(staff)/carriers/new/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { CarrierForm } from "@/modules/carriers/carrier-form";

export default async function NewCarrierPage() {
  const t = await getTranslations("carriers");
  return (
    <div>
      <PageHeader title={t("newCarrier")} />
      <CarrierForm initial={{ title: "", address: "", notes: "", contacts: [] }} />
    </div>
  );
}
```

- [ ] **Step 4: `src/app/(staff)/carriers/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCarrier } from "@/modules/carriers/queries";

export default async function CarrierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await getCarrier(id);
  if (!data) notFound();
  const { carrier, contacts, orders } = data;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={carrier.title}
        action={
          <Link
            href={`/carriers/${carrier.id}/edit`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("actions.edit")}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("nav.carriers")}</span>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">{t("fields.address")}</dt>
                <dd>{carrier.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.notes")}</dt>
                <dd className="whitespace-pre-wrap">{carrier.notes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("fields.createdAt")}</dt>
                <dd>{format.dateTime(carrier.createdAt, { dateStyle: "medium" })}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("fields.contacts")}</span>
          </CardHeader>
          <CardBody>
            {contacts.length === 0 && <p className="text-sm text-slate-400">—</p>}
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="font-medium">{c.name}</div>
                  {c.phones.length > 0 && <div className="text-slate-500">{c.phones.join(" · ")}</div>}
                  {c.emails.length > 0 && <div className="text-slate-500">{c.emails.join(" · ")}</div>}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <span className="text-sm font-semibold">{t("fields.orderHistory")}</span>
        </CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">{t("fields.noOrdersYet")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 first:border-0">
                    <td className="py-2 font-medium text-[#1a3a5c]">{o.number}</td>
                    <td className="py-2">{o.title}</td>
                    <td className="py-2">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2 text-slate-500">
                      {format.dateTime(o.createdAt, { dateStyle: "medium" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: `src/app/(staff)/carriers/[id]/edit/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { CarrierForm } from "@/modules/carriers/carrier-form";
import { getCarrier } from "@/modules/carriers/queries";

export default async function EditCarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("carriers");
  const data = await getCarrier(id);
  if (!data) notFound();

  return (
    <div>
      <PageHeader title={t("editCarrier")} />
      <CarrierForm
        initial={{
          id: data.carrier.id,
          title: data.carrier.title,
          address: data.carrier.address ?? "",
          notes: data.carrier.notes ?? "",
          contacts: data.contacts.map((c) => ({
            name: c.name,
            phones: c.phones.length ? c.phones : [""],
            emails: c.emails.length ? c.emails : [""],
          })),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit && npm test && npm run lint && npm run build` all clean; `curl -s -H "Cookie: $COOKIE" http://localhost:3000/carriers | grep -c "New carrier"` → ≥1.

- [ ] **Step 7: Commit**

```bash
git add src/modules/carriers "src/app/(staff)/carriers"
git commit -m "feat: carriers form and pages"
```

---

### Task 9: Phase close — full verification and manual checklist

- [ ] **Step 1: Full gate**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
npx tsx --env-file=.env scripts/check-schema.mts
```

Expected: all clean; `OK — schema verified: 14 tables, 10 enums, user→accounts FK`. Test count should now be ≥ 25 (13 from Phase 1 + audit 4 + accounts schema 5 + carriers schema 3).

- [ ] **Step 2: Browser manual checklist** (in the dockerized dev app, as admin)

1. /accounts → empty state → create "Baku Steel LLC" (tax ID, address, 1 contact with 2 phones + 1 email) → lands on profile, data correct.
2. Edit it: rename to "Baku Steel MMC", add a second contact → profile shows both contacts.
3. /carriers → create "Akın Logistics" with 1 contact → profile correct.
4. Switch language to RU → field labels and nav translate; data unchanged.
5. Audit check: `docker compose exec postgres psql -U freightops -c "select entity_type, action, field, new_value from audit_log order by created_at;"` → shows `account/created`, `account/updated` rows incl. `title: Baku Steel LLC → Baku Steel MMC`, and `carrier/created`.
6. Sign in as op1 (operator) → can create/edit accounts and carriers (staff-level operations per BRD §2).

- [ ] **Step 3: Commit any fixes, then close**

```bash
git add -A
git commit -m "chore: close phase 2a — entity foundation verified"
```

---

## Next: Phase 2b (planned after 2a lands)

Orders + Transportation, building on 2a's primitives: order-number generation `ORD-YYYY-NNN` (TDD, concurrency-safe), orders module (schema/queries/actions with status changes audited), orders list page with 10-status filter + search + merged columns, order form with Add-transport sub-flow (create new or attach existing transport mode), order detail (Info + History tabs reading audit_log), transportation page with derived status (least-advanced order status) and share statistics.
