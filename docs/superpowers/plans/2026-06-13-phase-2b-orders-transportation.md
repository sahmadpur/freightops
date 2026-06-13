# FreightOps Phase 2b — Orders & Transportation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Orders and Transportation placeholder pages with full functionality: concurrency-safe order numbering (ORD-YYYY-NNN), the orders module (CRUD + audited status changes + History tab), the main orders table (10-status filter + search + merged columns), the order form with an "add transport" sub-flow, and the Transportation page with per-transport-mode derived status and share statistics.

**Architecture:** Same module pattern as Phase 2a — feature modules under `src/modules/<entity>/` (zod schema + queries + server actions + form component); thin pages under `src/app/(staff)/`. Every mutation is a server action that re-checks `requireArea("staff")`, validates with zod, and writes audit rows in the same `db.transaction` as the change. Transport modes are built first so the order form can attach to an existing one; share statistics and derived transport status are computed in queries (not stored).

**Tech Stack:** Existing stack — Next.js 16 (App Router, server actions), Drizzle + Postgres, Better Auth (`requireArea`), next-intl, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-12-freightops-platform-design.md` (modules 3 "orders" + 4 "transport"), BRD §4.2/§4.3/§4.5. **Mock reference:** `docs/mock/freightops_mock.html` (Orders table, New Order modal, order detail tabs, Transportation cards) — match its style.

**Out of scope (later phases):** payments / financial deltas / receivable-payable status (Phase 3 — the order form captures the raw amount fields but no payment records or computed balances); documents upload, comment chat, email notifications (Phase 4); the order detail Finance/Documents/Comments tabs (Phase 3/4 — only Info + History tabs ship now); deleting orders or transport modes (not in BRD).

---

## Conventions (read first)

- **Dev environment:** `docker compose up -d` runs the app at `http://localhost:3000` with hot reload. Run one-off node scripts via `npx tsx --env-file=.env <file>` (top-level await needs a `.mts` file, NOT `tsx -e` — that fails in this CJS project). Tests/lint/tsc on the host (`npm test`, `npm run lint`, `npx tsc --noEmit`).
- **iCloud hazard:** this repo is under `~/Documents` (iCloud-synced). If `tsc` reports `.next/types/* 2.ts` duplicate-identifier errors or pages 500 with missing-manifest ENOENT, run `rm -rf .next` and retry; if source files have `* 2.ext` siblings, delete them (`find . \( -name "* 2" -o -name "* 2.*" \) -not -path './.git/*' -not -path './node_modules/*' -delete`).
- **Server-action security:** every `"use server"` function starts with `await requireArea("staff")`. Layout guards do NOT protect actions.
- **Audit:** every create/update writes audit rows via `recordAudit(tx, {...})` from `@/lib/audit` INSIDE the same `db.transaction`; use `auditDiff(before, after, FIELDS)` for field-level update diffs. A status change is audited as a `status` field change.
- **Money/qty:** drizzle `numeric` columns are `string | null` in/out — never use JS floats. Form inputs send strings; the zod schema validates numeric strings and the action writes them straight through.
- **Client form → navigation:** after a successful action, call `router.push(dest)` ONLY. Do NOT call `router.refresh()` afterward — it cancels the push navigation in Next.js 16 (the bug fixed at the end of Phase 2a).
- **Existing schema (Phase 1):** `orders` and `transportModes` tables already exist in `src/db/schema/domain.ts` with all columns — this phase does NOT alter them except adding the new `orderCounters` table. Order columns: id, number (unique), title, clientOrderId, accountId (FK notNull), carrierId (FK), transportModeId (FK), route, cargoDescription, packages (int), weightKg, volumeM3 (numeric), incoterms (enum), deliveryFormat (enum), status (orderStatusEnum default 'created'), clientCharge, carrierCost, additionalCosts, additionalCostsNote, expectedProfit, invoiceNumber, invoiceDate (date), amountReceivable, amountPayable, createdAt, updatedAt, createdBy. Transport columns: id, modeType (enum), number, fromCountry, toCountry, route, loadingDate, plannedArrivalDate (date), totalWeightKg, totalVolumeM3 (numeric), createdAt, updatedAt, createdBy.
- **Enums (already defined, import from `@/db/schema`):** `orderStatusEnum` (created, received, internal_transit, loaded, transit, at_border, at_customs, arrived, delivered, closed), `incotermsEnum` (EXW…DDP, 11), `deliveryFormatEnum` (FCL, LCL, FTL, LTL), `modeTypeEnum` (vehicle, air, postal, rail, sea). Each pgEnum exports `.enumValues` (e.g. `orderStatusEnum.enumValues`) — use that for zod enums and UI dropdowns so there's a single source of truth.
- **i18n status keys** already exist in all three catalogs (`status.created` … `status.closed`); the `StatusBadge` component (`@/components/ui/status-badge`) renders them.
- **Test users:** admin@freightops.local / admin12345 (admin), op1@freightops.local / operatortest123 (operator). Admin cookie for curl:

```bash
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"admin@freightops.local","password":"admin12345"}' | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)
```

- **Existing test data (leave in place):** accounts "Verify Co", "Baku Steel MMC"; carriers "Verify Carrier Co", "Akın Logistics". Orders/transport created by this phase's verification should be cleaned up (the phase-close task tracks this).

## File map

```
src/lib/forms.ts                          ActionResult (lifted from accounts/schema; neutral home)
src/lib/order-status.ts                   ORDER_STATUS_RANK + leastAdvancedStatus helper (+ test)
src/lib/order-number.ts                   formatOrderNumber + nextOrderNumber(tx) (+ test for formatter)
src/db/schema/domain.ts                   (modify) add orderCounters table
drizzle/0001_*.sql                        (generated) order_counters migration
scripts/check-schema.mts                  (modify) expect 15 tables, add order_counters
src/modules/transport/schema.ts           transportModeInputSchema (+ test)
src/modules/transport/queries.ts          listTransportModes (with derived status + share stats), getTransportMode, transportModeOptions
src/modules/transport/actions.ts          createTransportMode, updateTransportMode
src/modules/transport/transport-form.tsx  client form
src/modules/orders/schema.ts              orderInputSchema (incl. transport sub-union), statusChangeSchema (+ test)
src/modules/orders/queries.ts             listOrders, getOrder (incl. audit history), orderFormData (dropdown lists)
src/modules/orders/actions.ts             createOrder, updateOrder, changeOrderStatus
src/modules/orders/order-form.tsx         client form (incl. add-transport sub-flow)
src/modules/orders/order-detail-tabs.tsx  client tab switcher (Info + History)
src/app/(staff)/orders/page.tsx                 (replace) list + status filter + search
src/app/(staff)/orders/new/page.tsx             create
src/app/(staff)/orders/[id]/page.tsx            detail (tabs + status update)
src/app/(staff)/orders/[id]/edit/page.tsx       edit
src/app/(staff)/transportation/page.tsx         (replace) cards + stats
src/app/(staff)/transportation/new/page.tsx     create
src/app/(staff)/transportation/[id]/page.tsx    detail
src/app/(staff)/transportation/[id]/edit/page.tsx edit
messages/{en,ru,az}.json                  (modify) new namespaces: orders, transport, plus fields/incoterms/deliveryFormat/modeType additions
```

---

### Task 1: Lift `ActionResult` to a neutral module

The generic `ActionResult` type currently lives in `src/modules/accounts/schema.ts` and carriers reaches into accounts for it. Orders must not depend on accounts internals — move it to `src/lib/forms.ts` and re-point importers. (Phase 2a final-review cleanup item.)

**Files:**
- Create: `src/lib/forms.ts`
- Modify: `src/modules/accounts/schema.ts`, `src/modules/carriers/schema.ts`, `src/modules/carriers/carrier-form.tsx`

- [ ] **Step 1: Create `src/lib/forms.ts`**

```ts
/** Standard result shape returned by entity create/update server actions. */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };
```

- [ ] **Step 2: Re-point `src/modules/accounts/schema.ts`** — remove the local `ActionResult` definition (the `export type ActionResult = …` block at the bottom) and replace with a re-export so existing importers keep working:

Delete these lines:

```ts
/** Shared shape for the form's typed result. */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };
```

Add at the top (after the `import { z }` line):

```ts
export type { ActionResult } from "@/lib/forms";
```

- [ ] **Step 3: Re-point carriers** — in `src/modules/carriers/schema.ts` the line `import { contactInputSchema, type ActionResult } from "@/modules/accounts/schema";` and its `export type { ActionResult };` should source `ActionResult` from the neutral module. Change to:

```ts
import { contactInputSchema } from "@/modules/accounts/schema";
export { contactInputSchema };
export type { ActionResult } from "@/lib/forms";
```

(`contactInputSchema` legitimately stays in accounts — it's contacts-specific and shared by accounts+carriers only; orders don't use it.)

In `src/modules/carriers/carrier-form.tsx`, change `import type { ActionResult } from "@/modules/accounts/schema";` to `import type { ActionResult } from "@/lib/forms";`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: clean, 28 tests still pass (no behavior change).

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms.ts src/modules/accounts/schema.ts src/modules/carriers/schema.ts src/modules/carriers/carrier-form.tsx
git commit -m "refactor: move ActionResult to neutral src/lib/forms module"
```

---

### Task 2: Order-status ranking helper (TDD)

Derived transport status = the least-advanced status among a transport mode's orders. Define the canonical status ordering once.

**Files:**
- Create: `src/lib/order-status.ts`
- Test: `src/lib/order-status.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/order-status.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { ORDER_STATUS_RANK, leastAdvancedStatus } from "./order-status";

describe("ORDER_STATUS_RANK", () => {
  it("orders the lifecycle from created (0) to closed (9)", () => {
    expect(ORDER_STATUS_RANK.created).toBe(0);
    expect(ORDER_STATUS_RANK.closed).toBe(9);
    expect(ORDER_STATUS_RANK.transit).toBeGreaterThan(ORDER_STATUS_RANK.loaded);
    expect(ORDER_STATUS_RANK.at_customs).toBeGreaterThan(ORDER_STATUS_RANK.at_border);
  });
});

describe("leastAdvancedStatus", () => {
  it("returns null for no statuses", () => {
    expect(leastAdvancedStatus([])).toBeNull();
  });
  it("returns the least-advanced status", () => {
    expect(leastAdvancedStatus(["transit", "loaded", "arrived"])).toBe("loaded");
    expect(leastAdvancedStatus(["delivered", "closed"])).toBe("delivered");
    expect(leastAdvancedStatus(["created"])).toBe("created");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './order-status'`

- [ ] **Step 3: Implement `src/lib/order-status.ts`**

```ts
import { orderStatusEnum } from "@/db/schema";

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

/** Canonical lifecycle order, derived from the enum definition (created → closed). */
export const ORDER_STATUS_RANK: Record<OrderStatus, number> = Object.fromEntries(
  orderStatusEnum.enumValues.map((s, i) => [s, i]),
) as Record<OrderStatus, number>;

/** The least-advanced (lowest-rank) status in the list, or null if empty. */
export function leastAdvancedStatus(statuses: OrderStatus[]): OrderStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((min, s) => (ORDER_STATUS_RANK[s] < ORDER_STATUS_RANK[min] ? s : min));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/order-status.ts src/lib/order-status.test.ts
git commit -m "feat: add order-status ranking and least-advanced helper"
```

---

### Task 3: Order numbering — counter table + generator (TDD)

Order numbers are `ORD-YYYY-NNN`, sequential within a year, generated concurrency-safely via a counter row updated inside the order-creation transaction.

**Files:**
- Modify: `src/db/schema/domain.ts` (add `orderCounters`), `scripts/check-schema.mts`
- Create: `src/lib/order-number.ts`, `src/lib/order-number.test.ts`, generated `drizzle/0001_*.sql`

- [ ] **Step 1: Add the `orderCounters` table to `src/db/schema/domain.ts`**

Append after the `orders` table definition (it has no audit/createdBy columns — it's an internal counter):

```ts
export const orderCounters = pgTable("order_counters", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
});
```

(`integer` and `pgTable` are already imported in this file.)

- [ ] **Step 2: Generate and run the migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new `drizzle/0001_*.sql` creating `order_counters`; "migrations applied". (If drizzle prompts about anything other than creating order_counters, abort and report — nothing else should have changed.)

- [ ] **Step 3: Write the failing test `src/lib/order-number.test.ts`** (pure formatter only; the atomic counter is integration-verified in Step 6)

```ts
import { describe, expect, it } from "vitest";
import { formatOrderNumber } from "./order-number";

describe("formatOrderNumber", () => {
  it("zero-pads the sequence to 3 digits", () => {
    expect(formatOrderNumber(2026, 1)).toBe("ORD-2026-001");
    expect(formatOrderNumber(2026, 41)).toBe("ORD-2026-041");
  });
  it("does not truncate sequences beyond 999", () => {
    expect(formatOrderNumber(2026, 1234)).toBe("ORD-2026-1234");
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './order-number'`

- [ ] **Step 5: Implement `src/lib/order-number.ts`**

```ts
import { sql } from "drizzle-orm";
import { orderCounters } from "@/db/schema";
import type { db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function formatOrderNumber(year: number, seq: number): string {
  return `ORD-${year}-${String(seq).padStart(3, "0")}`;
}

/**
 * Atomically allocate the next order number for `year`. MUST run inside the
 * order-creation transaction. The upsert takes a row lock on the counter,
 * so concurrent creates serialize and never collide.
 */
export async function nextOrderNumber(tx: Tx, year: number): Promise<string> {
  const [row] = await tx
    .insert(orderCounters)
    .values({ year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: orderCounters.year,
      set: { lastNumber: sql`${orderCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: orderCounters.lastNumber });
  return formatOrderNumber(year, row.lastNumber);
}
```

- [ ] **Step 6: Run tests, then integration-verify atomicity** (real DB)

Run: `npm test` → all pass.

Create a throwaway `t3check.mts` in the repo root, run `npx tsx --env-file=.env t3check.mts`, then delete it:

```ts
import { db } from "./src/db";
import { orderCounters } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { nextOrderNumber } from "./src/lib/order-number";

const YEAR = 9999; // sentinel year, cleaned up below
// 20 concurrent allocations must yield 20 distinct sequential numbers
const results = await Promise.all(
  Array.from({ length: 20 }, () => db.transaction((tx) => nextOrderNumber(tx, YEAR))),
);
const unique = new Set(results);
console.log("allocated:", results.length, "unique:", unique.size);
console.log("sample:", results.slice(0, 3));
await db.delete(orderCounters).where(eq(orderCounters.year, YEAR));
console.log(unique.size === 20 ? "PASS: no collisions" : "FAIL: collisions!");
process.exit(unique.size === 20 ? 0 : 1);
```

Expected: `allocated: 20 unique: 20` and `PASS: no collisions`.

- [ ] **Step 7: Update `scripts/check-schema.mts`** — add `"order_counters"` to the expected-tables list and bump the success message count from 14 to 15. Run it:

```bash
npx tsx --env-file=.env scripts/check-schema.mts
```

Expected: `OK — schema verified: 15 tables, 10 enums, user→accounts FK` (adjust the wording only if the existing line differs; match its existing format, just +1 table).

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/domain.ts drizzle src/lib/order-number.ts src/lib/order-number.test.ts scripts/check-schema.mts
git commit -m "feat: add order_counters table and concurrency-safe ORD-YYYY-NNN generator"
```

---

### Task 4: i18n additions for orders & transportation

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`, `messages/az.json`

- [ ] **Step 1: Add new namespaces + field keys to all three catalogs**

Add three new top-level namespaces (`orders`, `transport`) and extend the existing `fields` namespace. Keep all existing namespaces/keys untouched. `messages/en.json` additions:

```json
{
  "orders": {
    "title": "Orders",
    "newOrder": "New order",
    "editOrder": "Edit order",
    "notFound": "Order not found",
    "searchPlaceholder": "Search orders, clients, route...",
    "empty": "No orders yet — create the first one.",
    "allOrders": "All orders",
    "tabInfo": "Order info",
    "tabHistory": "History",
    "updateStatus": "Update status",
    "deliveryHistory": "Delivery history",
    "noHistory": "No history yet"
  },
  "transport": {
    "title": "Transportation",
    "newTransport": "New transport",
    "editTransport": "Edit transport",
    "notFound": "Transport not found",
    "empty": "No transport modes yet — create the first one.",
    "ourOrdersTotal": "Our orders",
    "weight": "Weight (ours)",
    "volume": "Volume (ours)",
    "revenue": "Revenue (our cargo)",
    "carrierCostShare": "Carrier cost (our share)",
    "profit": "Profit (our cargo)",
    "ordersOnThisTransport": "Orders on this transport"
  },
  "fields": {
    "orderId": "Order ID",
    "orderTitle": "Order title",
    "clientOrderId": "Client order ID",
    "client": "Client (account)",
    "carrier": "Carrier",
    "route": "Route",
    "cargoDescription": "Cargo description",
    "packages": "Packages / units",
    "weightKg": "Weight (kg)",
    "volumeM3": "Volume (m³)",
    "incoterms": "Delivery terms (Incoterms 2020)",
    "deliveryFormat": "Cargo delivery format",
    "status": "Status",
    "clientCharge": "Client charge (selling price)",
    "carrierCost": "Carrier cost",
    "additionalCosts": "Additional costs",
    "expectedProfit": "Expected profit",
    "actualProfit": "Actual profit",
    "invoiceNumber": "Invoice number",
    "invoiceDate": "Invoice date",
    "transport": "Transport",
    "transportMode": "Transportation mode",
    "modeType": "Mode type",
    "transportNumber": "Transport mode number",
    "fromCountry": "From",
    "toCountry": "To",
    "loadingDate": "Loading date",
    "plannedArrivalDate": "Planned arrival date",
    "totalWeightKg": "Total capacity weight (kg)",
    "totalVolumeM3": "Total capacity volume (m³)",
    "addTransport": "Add transport",
    "noTransport": "No transport",
    "attachExisting": "Attach to existing transport",
    "createNew": "Create new transport",
    "lastModified": "Last modified",
    "selectAccount": "Select account…",
    "selectCarrier": "Select carrier…",
    "selectTransport": "Select transport…"
  }
}
```

`messages/ru.json` additions:

```json
{
  "orders": {
    "title": "Заказы",
    "newOrder": "Новый заказ",
    "editOrder": "Изменить заказ",
    "notFound": "Заказ не найден",
    "searchPlaceholder": "Поиск заказов, клиентов, маршрутов...",
    "empty": "Заказов пока нет — создайте первый.",
    "allOrders": "Все заказы",
    "tabInfo": "Информация",
    "tabHistory": "История",
    "updateStatus": "Изменить статус",
    "deliveryHistory": "История доставки",
    "noHistory": "Истории пока нет"
  },
  "transport": {
    "title": "Транспорт",
    "newTransport": "Новый транспорт",
    "editTransport": "Изменить транспорт",
    "notFound": "Транспорт не найден",
    "empty": "Транспорта пока нет — создайте первый.",
    "ourOrdersTotal": "Наши заказы",
    "weight": "Вес (наш)",
    "volume": "Объём (наш)",
    "revenue": "Выручка (наш груз)",
    "carrierCostShare": "Расходы перевозчика (наша доля)",
    "profit": "Прибыль (наш груз)",
    "ordersOnThisTransport": "Заказы на этом транспорте"
  },
  "fields": {
    "orderId": "Номер заказа",
    "orderTitle": "Название заказа",
    "clientOrderId": "Номер заказа клиента",
    "client": "Клиент (аккаунт)",
    "carrier": "Перевозчик",
    "route": "Маршрут",
    "cargoDescription": "Описание груза",
    "packages": "Места / единицы",
    "weightKg": "Вес (кг)",
    "volumeM3": "Объём (м³)",
    "incoterms": "Условия поставки (Инкотермс 2020)",
    "deliveryFormat": "Формат доставки груза",
    "status": "Статус",
    "clientCharge": "Сумма клиента (цена продажи)",
    "carrierCost": "Расходы перевозчика",
    "additionalCosts": "Дополнительные расходы",
    "expectedProfit": "Ожидаемая прибыль",
    "actualProfit": "Фактическая прибыль",
    "invoiceNumber": "Номер счёта",
    "invoiceDate": "Дата счёта",
    "transport": "Транспорт",
    "transportMode": "Вид транспорта",
    "modeType": "Тип транспорта",
    "transportNumber": "Номер транспорта",
    "fromCountry": "Откуда",
    "toCountry": "Куда",
    "loadingDate": "Дата погрузки",
    "plannedArrivalDate": "Планируемая дата прибытия",
    "totalWeightKg": "Общая вместимость по весу (кг)",
    "totalVolumeM3": "Общая вместимость по объёму (м³)",
    "addTransport": "Добавить транспорт",
    "noTransport": "Без транспорта",
    "attachExisting": "Привязать к существующему транспорту",
    "createNew": "Создать новый транспорт",
    "lastModified": "Изменено",
    "selectAccount": "Выберите клиента…",
    "selectCarrier": "Выберите перевозчика…",
    "selectTransport": "Выберите транспорт…"
  }
}
```

`messages/az.json` additions:

```json
{
  "orders": {
    "title": "Sifarişlər",
    "newOrder": "Yeni sifariş",
    "editOrder": "Sifarişi redaktə et",
    "notFound": "Sifariş tapılmadı",
    "searchPlaceholder": "Sifariş, müştəri, marşrut axtar...",
    "empty": "Hələ sifariş yoxdur — birincisini yaradın.",
    "allOrders": "Bütün sifarişlər",
    "tabInfo": "Məlumat",
    "tabHistory": "Tarixçə",
    "updateStatus": "Statusu dəyiş",
    "deliveryHistory": "Çatdırılma tarixçəsi",
    "noHistory": "Hələ tarixçə yoxdur"
  },
  "transport": {
    "title": "Nəqliyyat",
    "newTransport": "Yeni nəqliyyat",
    "editTransport": "Nəqliyyatı redaktə et",
    "notFound": "Nəqliyyat tapılmadı",
    "empty": "Hələ nəqliyyat yoxdur — birincisini yaradın.",
    "ourOrdersTotal": "Bizim sifarişlər",
    "weight": "Çəki (bizim)",
    "volume": "Həcm (bizim)",
    "revenue": "Gəlir (bizim yük)",
    "carrierCostShare": "Daşıyıcı xərci (bizim pay)",
    "profit": "Mənfəət (bizim yük)",
    "ordersOnThisTransport": "Bu nəqliyyatdakı sifarişlər"
  },
  "fields": {
    "orderId": "Sifariş nömrəsi",
    "orderTitle": "Sifarişin adı",
    "clientOrderId": "Müştəri sifariş nömrəsi",
    "client": "Müştəri (hesab)",
    "carrier": "Daşıyıcı",
    "route": "Marşrut",
    "cargoDescription": "Yükün təsviri",
    "packages": "Yerlər / vahidlər",
    "weightKg": "Çəki (kq)",
    "volumeM3": "Həcm (m³)",
    "incoterms": "Çatdırılma şərtləri (Incoterms 2020)",
    "deliveryFormat": "Yük çatdırılma formatı",
    "status": "Status",
    "clientCharge": "Müştəri haqqı (satış qiyməti)",
    "carrierCost": "Daşıyıcı xərci",
    "additionalCosts": "Əlavə xərclər",
    "expectedProfit": "Gözlənilən mənfəət",
    "actualProfit": "Faktiki mənfəət",
    "invoiceNumber": "Qaimə nömrəsi",
    "invoiceDate": "Qaimə tarixi",
    "transport": "Nəqliyyat",
    "transportMode": "Nəqliyyat növü",
    "modeType": "Nəqliyyat tipi",
    "transportNumber": "Nəqliyyat nömrəsi",
    "fromCountry": "Haradan",
    "toCountry": "Haraya",
    "loadingDate": "Yükləmə tarixi",
    "plannedArrivalDate": "Planlaşdırılan çatma tarixi",
    "totalWeightKg": "Ümumi tutum çəki (kq)",
    "totalVolumeM3": "Ümumi tutum həcm (m³)",
    "addTransport": "Nəqliyyat əlavə et",
    "noTransport": "Nəqliyyatsız",
    "attachExisting": "Mövcud nəqliyyata bağla",
    "createNew": "Yeni nəqliyyat yarat",
    "lastModified": "Dəyişdirilib",
    "selectAccount": "Müştəri seçin…",
    "selectCarrier": "Daşıyıcı seçin…",
    "selectTransport": "Nəqliyyat seçin…"
  }
}
```

- [ ] **Step 2: Verify key parity**

```bash
for f in en ru az; do python3 -c "
import json
d=json.load(open('messages/$f.json'))
def paths(o,p=''):
  for k,v in o.items():
    yield from (paths(v,p+'.'+k) if isinstance(v,dict) else [p+'.'+k])
print('$f', len(sorted(paths(d))))
"; done
```

Expected: identical counts across en/ru/az. Then `npm run build` → clean.

- [ ] **Step 3: Commit**

```bash
git add messages
git commit -m "feat: add orders/transport i18n keys for en, ru, az"
```

---

### Task 5: Transport module core (TDD on schema)

**Files:**
- Create: `src/modules/transport/schema.ts`, `src/modules/transport/queries.ts`, `src/modules/transport/actions.ts`
- Test: `src/modules/transport/schema.test.ts`

- [ ] **Step 1: Write the failing test `src/modules/transport/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { transportModeInputSchema } from "./schema";

const valid = {
  modeType: "vehicle",
  number: "TRK-0188",
  fromCountry: "Türkiye",
  toCountry: "Azerbaijan",
  route: "Istanbul → Baku",
  loadingDate: "2026-06-01",
  plannedArrivalDate: "2026-06-12",
  totalWeightKg: "18000",
  totalVolumeM3: "52",
};

describe("transportModeInputSchema", () => {
  it("accepts a valid transport mode", () => {
    expect(transportModeInputSchema.safeParse(valid).success).toBe(true);
  });
  it("requires modeType to be a known value", () => {
    expect(transportModeInputSchema.safeParse({ ...valid, modeType: "rocket" }).success).toBe(false);
  });
  it("requires a number", () => {
    expect(transportModeInputSchema.safeParse({ ...valid, number: " " }).success).toBe(false);
  });
  it("allows empty optional fields", () => {
    const r = transportModeInputSchema.safeParse({ modeType: "air", number: "AIR-044" });
    expect(r.success).toBe(true);
  });
  it("rejects non-numeric weight", () => {
    expect(transportModeInputSchema.safeParse({ ...valid, totalWeightKg: "heavy" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` → FAIL (`Cannot find module './schema'`)

- [ ] **Step 3: Implement `src/modules/transport/schema.ts`**

```ts
import { z } from "zod";
import { modeTypeEnum } from "@/db/schema";

/** Optional numeric string: "", absent, or a number with up to 2 decimals. */
export const numericString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a number")
  .optional()
  .or(z.literal(""));

/** Optional ISO date string (yyyy-mm-dd) or empty. */
export const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date")
  .optional()
  .or(z.literal(""));

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const transportModeInputSchema = z.object({
  modeType: z.enum(modeTypeEnum.enumValues),
  number: z.string().trim().min(1).max(100),
  fromCountry: optText(100),
  toCountry: optText(100),
  route: optText(300),
  loadingDate: dateString,
  plannedArrivalDate: dateString,
  totalWeightKg: numericString,
  totalVolumeM3: numericString,
});

export type TransportModeInput = z.infer<typeof transportModeInputSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass. (If `z.enum(modeTypeEnum.enumValues)` is rejected by the installed zod for a readonly tuple, use `z.enum(modeTypeEnum.enumValues as unknown as [string, ...string[]])` — verify which the version accepts.)

- [ ] **Step 5: Implement `src/modules/transport/queries.ts`**

```ts
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { transportModes, orders } from "@/db/schema";
import { leastAdvancedStatus, type OrderStatus } from "@/lib/order-status";

export type TransportListRow = {
  id: string;
  modeType: string;
  number: string;
  fromCountry: string | null;
  toCountry: string | null;
  route: string | null;
  loadingDate: string | null;
  plannedArrivalDate: string | null;
  totalWeightKg: string | null;
  totalVolumeM3: string | null;
  derivedStatus: OrderStatus | null;
  orderCount: number;
  // Share stats summed over this transport mode's orders (our cargo).
  ourWeightKg: number;
  ourVolumeM3: number;
  revenue: number;
  carrierCost: number;
  profit: number;
};

function num(v: string | null): number {
  return v ? Number(v) : 0;
}

export async function listTransportModes(): Promise<TransportListRow[]> {
  const modes = await db.select().from(transportModes).orderBy(desc(transportModes.createdAt));
  if (modes.length === 0) return [];

  const ids = modes.map((m) => m.id);
  const orderRows = await db
    .select({
      transportModeId: orders.transportModeId,
      status: orders.status,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      clientCharge: orders.clientCharge,
      carrierCost: orders.carrierCost,
    })
    .from(orders)
    .where(inArray(orders.transportModeId, ids));

  const byMode = new Map<string, typeof orderRows>();
  for (const o of orderRows) {
    if (!o.transportModeId) continue;
    const list = byMode.get(o.transportModeId) ?? [];
    list.push(o);
    byMode.set(o.transportModeId, list);
  }

  return modes.map((m) => {
    const os = byMode.get(m.id) ?? [];
    const statuses = os.map((o) => o.status as OrderStatus);
    const revenue = os.reduce((s, o) => s + num(o.clientCharge), 0);
    const carrierCost = os.reduce((s, o) => s + num(o.carrierCost), 0);
    return {
      id: m.id,
      modeType: m.modeType,
      number: m.number,
      fromCountry: m.fromCountry,
      toCountry: m.toCountry,
      route: m.route,
      loadingDate: m.loadingDate,
      plannedArrivalDate: m.plannedArrivalDate,
      totalWeightKg: m.totalWeightKg,
      totalVolumeM3: m.totalVolumeM3,
      derivedStatus: leastAdvancedStatus(statuses),
      orderCount: os.length,
      ourWeightKg: os.reduce((s, o) => s + num(o.weightKg), 0),
      ourVolumeM3: os.reduce((s, o) => s + num(o.volumeM3), 0),
      revenue,
      carrierCost,
      profit: revenue - carrierCost,
    };
  });
}

export async function getTransportMode(id: string) {
  const mode = await db.query.transportModes.findFirst({ where: eq(transportModes.id, id) });
  if (!mode) return null;
  const modeOrders = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      status: orders.status,
      accountId: orders.accountId,
    })
    .from(orders)
    .where(eq(orders.transportModeId, id))
    .orderBy(desc(orders.createdAt));
  return { mode, orders: modeOrders };
}

/** Lightweight list for the order form's "attach existing transport" dropdown. */
export async function transportModeOptions() {
  return db
    .select({ id: transportModes.id, number: transportModes.number, modeType: transportModes.modeType })
    .from(transportModes)
    .orderBy(desc(transportModes.createdAt))
    .limit(500);
}
```

- [ ] **Step 6: Implement `src/modules/transport/actions.ts`**

```ts
"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transportModes } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { transportModeInputSchema, type TransportModeInput } from "./schema";
import type { ActionResult } from "@/lib/forms";

const AUDITED_FIELDS = [
  "modeType", "number", "fromCountry", "toCountry", "route",
  "loadingDate", "plannedArrivalDate", "totalWeightKg", "totalVolumeM3",
];

/** Map validated input to DB column values (empty strings → null). */
function toRow(data: TransportModeInput) {
  return {
    modeType: data.modeType,
    number: data.number,
    fromCountry: data.fromCountry || null,
    toCountry: data.toCountry || null,
    route: data.route || null,
    loadingDate: data.loadingDate || null,
    plannedArrivalDate: data.plannedArrivalDate || null,
    totalWeightKg: data.totalWeightKg || null,
    totalVolumeM3: data.totalVolumeM3 || null,
  };
}

export async function createTransportMode(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = transportModeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transportModes)
      .values({ ...toRow(parsed.data), createdBy: session.user.id })
      .returning({ id: transportModes.id });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "transport_mode",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function updateTransportMode(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = transportModeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.transportModes.findFirst({ where: eq(transportModes.id, id) });
    if (!before) return "not_found" as const;
    const after = toRow(parsed.data);
    await tx.update(transportModes).set(after).where(eq(transportModes.id, id));
    const changes = auditDiff(before, after, AUDITED_FIELDS);
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "transport_mode",
        entityId: id,
        action: "updated",
        changes,
      });
    }
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm test && npm run lint` → clean. Then a query round-trip via temp `t5check.mts` (run, then delete):

```ts
import { listTransportModes, getTransportMode, transportModeOptions } from "./src/modules/transport/queries";
console.log("list:", (await listTransportModes()).length);
console.log("options:", (await transportModeOptions()).length);
console.log("missing:", await getTransportMode("nope"));
process.exit(0);
```

Expected: `list: 0`, `options: 0`, `missing: null`.

- [ ] **Step 8: Commit**

```bash
git add src/modules/transport
git commit -m "feat: transport module core — schema, queries (derived status + share stats), actions"
```

---

### Task 6: Transport form and pages

**Files:**
- Create: `src/modules/transport/transport-form.tsx`, `src/app/(staff)/transportation/new/page.tsx`, `src/app/(staff)/transportation/[id]/page.tsx`, `src/app/(staff)/transportation/[id]/edit/page.tsx`
- Modify: `src/app/(staff)/transportation/page.tsx` (replace placeholder)

- [ ] **Step 1: `src/modules/transport/transport-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { createTransportMode, updateTransportMode } from "./actions";
import type { ActionResult } from "@/lib/forms";

const MODE_TYPES = ["vehicle", "air", "postal", "rail", "sea"] as const;

export type TransportFormInitial = {
  id?: string;
  modeType: string;
  number: string;
  fromCountry: string;
  toCountry: string;
  route: string;
  loadingDate: string;
  plannedArrivalDate: string;
  totalWeightKg: string;
  totalVolumeM3: string;
};

export function TransportForm({ initial }: { initial: TransportFormInitial }) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const set = (patch: Partial<TransportFormInitial>) => setV((s) => ({ ...s, ...patch }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { id, ...payload } = v;
    const r = id ? await updateTransportMode(id, payload) : await createTransportMode(payload);
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/transportation/${r.id}`);
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.modeType")} htmlFor="modeType" error={fe.modeType}>
          <select id="modeType" className={inputCls} value={v.modeType} onChange={(e) => set({ modeType: e.target.value })}>
            {MODE_TYPES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label={t("fields.transportNumber")} htmlFor="number" error={fe.number}>
          <input id="number" required className={inputCls} value={v.number} onChange={(e) => set({ number: e.target.value })} />
        </Field>
        <Field label={t("fields.fromCountry")} htmlFor="fromCountry" error={fe.fromCountry}>
          <input id="fromCountry" className={inputCls} value={v.fromCountry} onChange={(e) => set({ fromCountry: e.target.value })} />
        </Field>
        <Field label={t("fields.toCountry")} htmlFor="toCountry" error={fe.toCountry}>
          <input id="toCountry" className={inputCls} value={v.toCountry} onChange={(e) => set({ toCountry: e.target.value })} />
        </Field>
        <Field label={t("fields.route")} htmlFor="route" error={fe.route}>
          <input id="route" className={inputCls} value={v.route} onChange={(e) => set({ route: e.target.value })} />
        </Field>
        <div />
        <Field label={t("fields.loadingDate")} htmlFor="loadingDate" error={fe.loadingDate}>
          <input id="loadingDate" type="date" className={inputCls} value={v.loadingDate} onChange={(e) => set({ loadingDate: e.target.value })} />
        </Field>
        <Field label={t("fields.plannedArrivalDate")} htmlFor="plannedArrivalDate" error={fe.plannedArrivalDate}>
          <input id="plannedArrivalDate" type="date" className={inputCls} value={v.plannedArrivalDate} onChange={(e) => set({ plannedArrivalDate: e.target.value })} />
        </Field>
        <Field label={t("fields.totalWeightKg")} htmlFor="totalWeightKg" error={fe.totalWeightKg}>
          <input id="totalWeightKg" className={inputCls} value={v.totalWeightKg} onChange={(e) => set({ totalWeightKg: e.target.value })} />
        </Field>
        <Field label={t("fields.totalVolumeM3")} htmlFor="totalVolumeM3" error={fe.totalVolumeM3}>
          <input id="totalVolumeM3" className={inputCls} value={v.totalVolumeM3} onChange={(e) => set({ totalVolumeM3: e.target.value })} />
        </Field>
      </div>
      {result && !result.ok && result.error && <p className="text-sm text-red-700">{result.error}</p>}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={initial.id ? `/transportation/${initial.id}` : "/transportation"}
        cancelLabel={t("actions.cancel")}
      />
    </form>
  );
}
```

- [ ] **Step 2: Replace `src/app/(staff)/transportation/page.tsx` with the cards list**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { listTransportModes } from "@/modules/transport/queries";

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function TransportationPage() {
  const t = await getTranslations();
  const modes = await listTransportModes();

  return (
    <div>
      <PageHeader
        title={t("nav.transportation")}
        action={
          <Link href="/transportation/new" className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white">
            + {t("transport.newTransport")}
          </Link>
        }
      />
      {modes.length === 0 && <p className="text-sm text-slate-400">{t("transport.empty")}</p>}
      <div className="space-y-3">
        {modes.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {m.number}
                  {m.derivedStatus && <StatusBadge status={m.derivedStatus} />}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {m.modeType}
                  {m.route ? ` · ${m.route}` : ""}
                  {m.loadingDate ? ` · ${t("fields.loadingDate")}: ${m.loadingDate}` : ""}
                  {m.plannedArrivalDate ? ` · ${t("fields.plannedArrivalDate")}: ${m.plannedArrivalDate}` : ""}
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <Link className="text-[#1a3a5c] hover:underline" href={`/transportation/${m.id}`}>{t("actions.view")}</Link>
                <Link className="text-[#1a3a5c] hover:underline" href={`/transportation/${m.id}/edit`}>{t("actions.edit")}</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t("transport.ourOrdersTotal")} value={`${m.orderCount}`} />
              <Stat label={t("transport.weight")} value={`${fmt(m.ourWeightKg)}${m.totalWeightKg ? ` / ${fmt(Number(m.totalWeightKg))}` : ""} kg`} />
              <Stat label={t("transport.volume")} value={`${fmt(m.ourVolumeM3)}${m.totalVolumeM3 ? ` / ${fmt(Number(m.totalVolumeM3))}` : ""} m³`} />
              <Stat label={t("transport.revenue")} value={`$${fmt(m.revenue)}`} />
              <Stat label={t("transport.carrierCostShare")} value={`$${fmt(m.carrierCost)}`} />
              <Stat label={t("transport.profit")} value={`$${fmt(m.profit)}`} positive={m.profit >= 0} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-[10.5px] text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${positive ? "text-[#3b6d11]" : ""}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/(staff)/transportation/new/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { TransportForm } from "@/modules/transport/transport-form";

export default async function NewTransportPage() {
  const t = await getTranslations("transport");
  return (
    <div>
      <PageHeader title={t("newTransport")} />
      <TransportForm
        initial={{
          modeType: "vehicle",
          number: "",
          fromCountry: "",
          toCountry: "",
          route: "",
          loadingDate: "",
          plannedArrivalDate: "",
          totalWeightKg: "",
          totalVolumeM3: "",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: `src/app/(staff)/transportation/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTransportMode } from "@/modules/transport/queries";

export default async function TransportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const data = await getTransportMode(id);
  if (!data) notFound();
  const { mode, orders } = data;

  const row = (label: string, value: string | null) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={mode.number}
        action={
          <Link href={`/transportation/${mode.id}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {t("actions.edit")}
          </Link>
        }
      />
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("nav.transportation")}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {row(t("fields.modeType"), mode.modeType)}
            {row(t("fields.route"), mode.route)}
            {row(t("fields.fromCountry"), mode.fromCountry)}
            {row(t("fields.toCountry"), mode.toCountry)}
            {row(t("fields.loadingDate"), mode.loadingDate)}
            {row(t("fields.plannedArrivalDate"), mode.plannedArrivalDate)}
            {row(t("fields.totalWeightKg"), mode.totalWeightKg)}
            {row(t("fields.totalVolumeM3"), mode.totalVolumeM3)}
          </dl>
        </CardBody>
      </Card>
      <Card className="mt-4">
        <CardHeader><span className="text-sm font-semibold">{t("transport.ordersOnThisTransport")}</span></CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">{t("fields.noOrdersYet")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 first:border-0">
                    <td className="py-2">
                      <Link href={`/orders/${o.id}`} className="font-medium text-[#1a3a5c] hover:underline">{o.number}</Link>
                    </td>
                    <td className="py-2">{o.title}</td>
                    <td className="py-2"><StatusBadge status={o.status} /></td>
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

- [ ] **Step 5: `src/app/(staff)/transportation/[id]/edit/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { TransportForm } from "@/modules/transport/transport-form";
import { getTransportMode } from "@/modules/transport/queries";

export default async function EditTransportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("transport");
  const data = await getTransportMode(id);
  if (!data) notFound();
  const m = data.mode;

  return (
    <div>
      <PageHeader title={t("editTransport")} />
      <TransportForm
        initial={{
          id: m.id,
          modeType: m.modeType,
          number: m.number,
          fromCountry: m.fromCountry ?? "",
          toCountry: m.toCountry ?? "",
          route: m.route ?? "",
          loadingDate: m.loadingDate ?? "",
          plannedArrivalDate: m.plannedArrivalDate ?? "",
          totalWeightKg: m.totalWeightKg ?? "",
          totalVolumeM3: m.totalVolumeM3 ?? "",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify** (dockerized dev server up)

```bash
npx tsc --noEmit && npm test && npm run lint && npm run build
```

All clean. Then with the admin cookie:
- `curl -s -H "Cookie: $COOKIE" http://localhost:3000/transportation | grep -c "New transport"` → ≥1
- `curl -s -H "Cookie: $COOKIE" http://localhost:3000/transportation/new | grep -c "Transport mode number"` → ≥1
- Data-layer e2e via temp script replicating createTransportMode (insert transport + recordAudit 'created') for "TRK-VERIFY", then: list page contains "TRK-VERIFY"; `/transportation/<id>` renders; `/transportation/nonexistent` → 404. LEAVE "TRK-VERIFY" for the order tasks to attach to; report its id.

- [ ] **Step 7: Commit**

```bash
git add src/modules/transport/transport-form.tsx "src/app/(staff)/transportation"
git commit -m "feat: transportation pages — cards with derived status + share stats, form, detail"
```

---

### Task 7: Orders module — schema (TDD)

**Files:**
- Create: `src/modules/orders/schema.ts`
- Test: `src/modules/orders/schema.test.ts`

- [ ] **Step 1: Write the failing test `src/modules/orders/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { orderInputSchema, statusChangeSchema } from "./schema";

const base = {
  title: "Steel pipes",
  clientOrderId: "",
  accountId: "acc-123",
  carrierId: "",
  route: "Istanbul → Baku",
  cargoDescription: "Steel pipes",
  packages: "24",
  weightKg: "8400",
  volumeM3: "24",
  incoterms: "CIP",
  deliveryFormat: "FTL",
  clientCharge: "4200",
  carrierCost: "2800",
  additionalCosts: "",
  additionalCostsNote: "",
  expectedProfit: "1400",
  invoiceNumber: "",
  invoiceDate: "",
  transport: { mode: "none" },
};

describe("orderInputSchema", () => {
  it("accepts a valid order with no transport", () => {
    expect(orderInputSchema.safeParse(base).success).toBe(true);
  });
  it("requires a title and an accountId", () => {
    expect(orderInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, accountId: "" }).success).toBe(false);
  });
  it("rejects unknown incoterms and delivery format", () => {
    expect(orderInputSchema.safeParse({ ...base, incoterms: "ZZZ" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, deliveryFormat: "BULK" }).success).toBe(false);
  });
  it("allows empty incoterms/deliveryFormat (optional)", () => {
    expect(orderInputSchema.safeParse({ ...base, incoterms: "", deliveryFormat: "" }).success).toBe(true);
  });
  it("rejects non-numeric money fields", () => {
    expect(orderInputSchema.safeParse({ ...base, clientCharge: "lots" }).success).toBe(false);
  });
  it("accepts transport=existing with an id", () => {
    const r = orderInputSchema.safeParse({ ...base, transport: { mode: "existing", transportModeId: "tm-1" } });
    expect(r.success).toBe(true);
  });
  it("rejects transport=existing without an id", () => {
    const r = orderInputSchema.safeParse({ ...base, transport: { mode: "existing", transportModeId: "" } });
    expect(r.success).toBe(false);
  });
  it("accepts transport=new with mode type and number", () => {
    const r = orderInputSchema.safeParse({
      ...base,
      transport: { mode: "new", modeType: "vehicle", number: "TRK-1", fromCountry: "", toCountry: "", route: "", loadingDate: "", plannedArrivalDate: "", totalWeightKg: "", totalVolumeM3: "" },
    });
    expect(r.success).toBe(true);
  });
});

describe("statusChangeSchema", () => {
  it("accepts a valid status", () => {
    expect(statusChangeSchema.safeParse({ status: "transit" }).success).toBe(true);
  });
  it("rejects an unknown status", () => {
    expect(statusChangeSchema.safeParse({ status: "lost" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` → FAIL (`Cannot find module './schema'`)

- [ ] **Step 3: Implement `src/modules/orders/schema.ts`**

```ts
import { z } from "zod";
import { orderStatusEnum, incotermsEnum, deliveryFormatEnum } from "@/db/schema";
import { numericString, dateString, transportModeInputSchema } from "@/modules/transport/schema";

const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().or(z.literal(""));

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Transport sub-flow: none, attach existing, or create new (reuses transport schema).
 *  The "new" branch spreads transportModeInputSchema.shape so it stays a plain
 *  ZodObject — discriminatedUnion members must be objects, not intersections. */
const transportSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("existing"), transportModeId: z.string().trim().min(1) }),
  z.object({ mode: z.literal("new"), ...transportModeInputSchema.shape }),
]);

export const orderInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  clientOrderId: optText(100),
  accountId: z.string().trim().min(1),
  carrierId: optText(100),
  route: optText(300),
  cargoDescription: optText(1000),
  packages: z
    .string()
    .trim()
    .regex(/^\d+$/, "Must be a whole number")
    .optional()
    .or(z.literal("")),
  weightKg: numericString,
  volumeM3: numericString,
  incoterms: optEnum(incotermsEnum.enumValues),
  deliveryFormat: optEnum(deliveryFormatEnum.enumValues),
  clientCharge: numericString,
  carrierCost: numericString,
  additionalCosts: numericString,
  additionalCostsNote: optText(1000),
  expectedProfit: numericString,
  invoiceNumber: optText(100),
  invoiceDate: dateString,
  transport: transportSchema,
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(orderStatusEnum.enumValues),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass. (If `z.enum(enumValues)` or `optEnum` fights the installed zod's readonly-tuple typing, cast `enumValues as unknown as [string, ...string[]]` — the runtime behavior under test is the contract. The "new" transport branch uses the shape-spread form because `discriminatedUnion` members must be plain objects; do not switch it to `.and()`.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/orders/schema.ts src/modules/orders/schema.test.ts
git commit -m "feat: order input schema with transport sub-flow + status-change schema"
```

---

### Task 8: Orders module — queries and actions

**Files:**
- Create: `src/modules/orders/queries.ts`, `src/modules/orders/actions.ts`

- [ ] **Step 1: Implement `src/modules/orders/queries.ts`**

```ts
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, accounts, carriers, transportModes, auditLog } from "@/db/schema";
import { PAGE_SIZE } from "@/components/ui/paginator";
import type { OrderStatus } from "@/lib/order-status";

export type OrderListRow = {
  id: string;
  number: string;
  title: string;
  accountTitle: string;
  route: string | null;
  transportNumber: string | null;
  clientCharge: string | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
};

export async function listOrders(opts: { q?: string; status?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const conds = [];
  if (opts.status) conds.push(eq(orders.status, opts.status as OrderStatus));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(orders.number, like), ilike(orders.title, like), ilike(orders.route, like), ilike(accounts.title, like)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      accountTitle: accounts.title,
      route: orders.route,
      transportNumber: transportModes.number,
      clientCharge: orders.clientCharge,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(transportModes, eq(orders.transportModeId, transportModes.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .where(where);

  return { rows: rows as OrderListRow[], total, page };
}

export async function getOrder(id: string) {
  const [row] = await db
    .select({
      order: orders,
      accountTitle: accounts.title,
      carrierTitle: carriers.title,
      transportNumber: transportModes.number,
      transportModeType: transportModes.modeType,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(carriers, eq(orders.carrierId, carriers.id))
    .leftJoin(transportModes, eq(orders.transportModeId, transportModes.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return null;

  const history = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, "order"), eq(auditLog.entityId, id)))
    .orderBy(desc(auditLog.createdAt));

  return { ...row, history };
}

/** Dropdown data for the order form. */
export async function orderFormData() {
  const [accountOpts, carrierOpts] = await Promise.all([
    db.select({ id: accounts.id, title: accounts.title }).from(accounts).orderBy(accounts.title).limit(1000),
    db.select({ id: carriers.id, title: carriers.title }).from(carriers).orderBy(carriers.title).limit(1000),
  ]);
  return { accountOpts, carrierOpts };
}
```

- [ ] **Step 2: Implement `src/modules/orders/actions.ts`**

```ts
"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, transportModes } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { nextOrderNumber } from "@/lib/order-number";
import { requireArea } from "@/lib/session";
import { orderInputSchema, statusChangeSchema, type OrderInput } from "./schema";
import type { ActionResult } from "@/lib/forms";

const AUDITED_FIELDS = [
  "title", "clientOrderId", "accountId", "carrierId", "transportModeId", "route",
  "cargoDescription", "packages", "weightKg", "volumeM3", "incoterms", "deliveryFormat",
  "status", "clientCharge", "carrierCost", "additionalCosts", "additionalCostsNote",
  "expectedProfit", "invoiceNumber", "invoiceDate", "amountReceivable", "amountPayable",
];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Map validated scalar fields to DB columns (transport handled separately). */
function toRow(data: OrderInput) {
  return {
    title: data.title,
    clientOrderId: data.clientOrderId || null,
    accountId: data.accountId,
    carrierId: data.carrierId || null,
    route: data.route || null,
    cargoDescription: data.cargoDescription || null,
    packages: data.packages ? Number(data.packages) : null,
    weightKg: data.weightKg || null,
    volumeM3: data.volumeM3 || null,
    incoterms: data.incoterms || null,
    deliveryFormat: data.deliveryFormat || null,
    clientCharge: data.clientCharge || null,
    carrierCost: data.carrierCost || null,
    additionalCosts: data.additionalCosts || null,
    additionalCostsNote: data.additionalCostsNote || null,
    expectedProfit: data.expectedProfit || null,
    invoiceNumber: data.invoiceNumber || null,
    invoiceDate: data.invoiceDate || null,
  };
}

/** Resolve the transport sub-flow to a transportModeId, creating a new mode if requested. */
async function resolveTransport(tx: Tx, data: OrderInput, userId: string): Promise<string | null> {
  const tr = data.transport;
  if (tr.mode === "none") return null;
  if (tr.mode === "existing") return tr.transportModeId;
  // mode === "new"
  const [row] = await tx
    .insert(transportModes)
    .values({
      modeType: tr.modeType,
      number: tr.number,
      fromCountry: tr.fromCountry || null,
      toCountry: tr.toCountry || null,
      route: tr.route || null,
      loadingDate: tr.loadingDate || null,
      plannedArrivalDate: tr.plannedArrivalDate || null,
      totalWeightKg: tr.totalWeightKg || null,
      totalVolumeM3: tr.totalVolumeM3 || null,
      createdBy: userId,
    })
    .returning({ id: transportModes.id });
  await recordAudit(tx, { userId, entityType: "transport_mode", entityId: row.id, action: "created" });
  return row.id;
}

export async function createOrder(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const transportModeId = await resolveTransport(tx, data, session.user.id);
    const number = await nextOrderNumber(tx, new Date().getFullYear());
    const [row] = await tx
      .insert(orders)
      .values({ ...toRow(data), transportModeId, number, createdBy: session.user.id })
      .returning({ id: orders.id });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function updateOrder(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!before) return "not_found" as const;
    const transportModeId = await resolveTransport(tx, data, session.user.id);
    const after = { ...toRow(data), transportModeId };
    await tx.update(orders).set(after).where(eq(orders.id, id));
    const changes = auditDiff(before, after, AUDITED_FIELDS);
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "order",
        entityId: id,
        action: "updated",
        changes,
      });
    }
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}

/** Lightweight status update from the order detail page. */
export async function changeOrderStatus(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_status" };
  const { status } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!before) return "not_found" as const;
    if (before.status === status) return "ok" as const;
    await tx.update(orders).set({ status }).where(eq(orders.id, id));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: id,
      action: "status_changed",
      changes: [{ field: "status", oldValue: before.status, newValue: status }],
    });
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test && npm run lint` → clean. Then a query round-trip via temp `t8check.mts`:

```ts
import { listOrders, getOrder, orderFormData } from "./src/modules/orders/queries";
console.log("list total:", (await listOrders({})).total);
console.log("form data accounts:", (await orderFormData()).accountOpts.length);
console.log("missing:", await getOrder("nope"));
process.exit(0);
```

Expected: `list total: 0`, account count ≥ 2 (existing test accounts), `missing: null`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/orders/queries.ts src/modules/orders/actions.ts
git commit -m "feat: orders module — queries (list/detail/history) and audited actions with transport sub-flow"
```

---

### Task 9: Order form component

**Files:**
- Create: `src/modules/orders/order-form.tsx`

- [ ] **Step 1: Implement `src/modules/orders/order-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputCls, SubmitRow } from "@/components/ui/form";
import { createOrder, updateOrder } from "./actions";
import type { ActionResult } from "@/lib/forms";

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
const DELIVERY_FORMATS = ["FCL", "LCL", "FTL", "LTL"] as const;
const MODE_TYPES = ["vehicle", "air", "postal", "rail", "sea"] as const;

type Option = { id: string; title?: string; number?: string; modeType?: string };
type TransportMode = "none" | "existing" | "new";

export type OrderFormInitial = {
  id?: string;
  title: string;
  clientOrderId: string;
  accountId: string;
  carrierId: string;
  route: string;
  cargoDescription: string;
  packages: string;
  weightKg: string;
  volumeM3: string;
  incoterms: string;
  deliveryFormat: string;
  clientCharge: string;
  carrierCost: string;
  additionalCosts: string;
  additionalCostsNote: string;
  expectedProfit: string;
  invoiceNumber: string;
  invoiceDate: string;
  transportMode: TransportMode;
  transportModeId: string;
  newTransport: {
    modeType: string;
    number: string;
    fromCountry: string;
    toCountry: string;
    route: string;
    loadingDate: string;
    plannedArrivalDate: string;
    totalWeightKg: string;
    totalVolumeM3: string;
  };
};

export function OrderForm({
  initial,
  accountOpts,
  carrierOpts,
  transportOpts,
}: {
  initial: OrderFormInitial;
  accountOpts: Option[];
  carrierOpts: Option[];
  transportOpts: Option[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const set = (patch: Partial<OrderFormInitial>) => setV((s) => ({ ...s, ...patch }));
  const setNew = (patch: Partial<OrderFormInitial["newTransport"]>) =>
    setV((s) => ({ ...s, newTransport: { ...s.newTransport, ...patch } }));

  function buildTransport() {
    if (v.transportMode === "none") return { mode: "none" as const };
    if (v.transportMode === "existing") return { mode: "existing" as const, transportModeId: v.transportModeId };
    return { mode: "new" as const, ...v.newTransport };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = {
      title: v.title,
      clientOrderId: v.clientOrderId,
      accountId: v.accountId,
      carrierId: v.carrierId,
      route: v.route,
      cargoDescription: v.cargoDescription,
      packages: v.packages,
      weightKg: v.weightKg,
      volumeM3: v.volumeM3,
      incoterms: v.incoterms,
      deliveryFormat: v.deliveryFormat,
      clientCharge: v.clientCharge,
      carrierCost: v.carrierCost,
      additionalCosts: v.additionalCosts,
      additionalCostsNote: v.additionalCostsNote,
      expectedProfit: v.expectedProfit,
      invoiceNumber: v.invoiceNumber,
      invoiceDate: v.invoiceDate,
      transport: buildTransport(),
    };
    const r = v.id ? await updateOrder(v.id, payload) : await createOrder(payload);
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/orders/${r.id}`);
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const sectionCls = "mt-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";

  return (
    <form onSubmit={onSubmit} className="max-w-3xl">
      <div className={sectionCls}>{t("orders.title")}</div>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.orderTitle")} htmlFor="title" error={fe.title}>
          <input id="title" required className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={t("fields.clientOrderId")} htmlFor="clientOrderId" error={fe.clientOrderId}>
          <input id="clientOrderId" className={inputCls} value={v.clientOrderId} onChange={(e) => set({ clientOrderId: e.target.value })} />
        </Field>
        <Field label={t("fields.client")} htmlFor="accountId" error={fe.accountId}>
          <select id="accountId" required className={inputCls} value={v.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            <option value="">{t("fields.selectAccount")}</option>
            {accountOpts.map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
          </select>
        </Field>
        <Field label={t("fields.carrier")} htmlFor="carrierId" error={fe.carrierId}>
          <select id="carrierId" className={inputCls} value={v.carrierId} onChange={(e) => set({ carrierId: e.target.value })}>
            <option value="">{t("fields.selectCarrier")}</option>
            {carrierOpts.map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
          </select>
        </Field>
        <Field label={t("fields.route")} htmlFor="route" error={fe.route}>
          <input id="route" className={inputCls} value={v.route} onChange={(e) => set({ route: e.target.value })} />
        </Field>
        <div />
      </div>

      <div className={sectionCls}>{t("fields.cargoDescription")}</div>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.cargoDescription")} htmlFor="cargo" error={fe.cargoDescription}>
          <input id="cargo" className={inputCls} value={v.cargoDescription} onChange={(e) => set({ cargoDescription: e.target.value })} />
        </Field>
        <Field label={t("fields.packages")} htmlFor="packages" error={fe.packages}>
          <input id="packages" className={inputCls} value={v.packages} onChange={(e) => set({ packages: e.target.value })} />
        </Field>
        <Field label={t("fields.weightKg")} htmlFor="weightKg" error={fe.weightKg}>
          <input id="weightKg" className={inputCls} value={v.weightKg} onChange={(e) => set({ weightKg: e.target.value })} />
        </Field>
        <Field label={t("fields.volumeM3")} htmlFor="volumeM3" error={fe.volumeM3}>
          <input id="volumeM3" className={inputCls} value={v.volumeM3} onChange={(e) => set({ volumeM3: e.target.value })} />
        </Field>
        <Field label={t("fields.incoterms")} htmlFor="incoterms" error={fe.incoterms}>
          <select id="incoterms" className={inputCls} value={v.incoterms} onChange={(e) => set({ incoterms: e.target.value })}>
            <option value="">—</option>
            {INCOTERMS.map((i) => (<option key={i} value={i}>{i}</option>))}
          </select>
        </Field>
        <Field label={t("fields.deliveryFormat")} htmlFor="deliveryFormat" error={fe.deliveryFormat}>
          <select id="deliveryFormat" className={inputCls} value={v.deliveryFormat} onChange={(e) => set({ deliveryFormat: e.target.value })}>
            <option value="">—</option>
            {DELIVERY_FORMATS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </Field>
      </div>

      <div className={sectionCls}>{t("nav.finance")}</div>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t("fields.clientCharge")} htmlFor="clientCharge" error={fe.clientCharge}>
          <input id="clientCharge" className={inputCls} value={v.clientCharge} onChange={(e) => set({ clientCharge: e.target.value })} />
        </Field>
        <Field label={t("fields.carrierCost")} htmlFor="carrierCost" error={fe.carrierCost}>
          <input id="carrierCost" className={inputCls} value={v.carrierCost} onChange={(e) => set({ carrierCost: e.target.value })} />
        </Field>
        <Field label={t("fields.additionalCosts")} htmlFor="additionalCosts" error={fe.additionalCosts}>
          <input id="additionalCosts" className={inputCls} value={v.additionalCosts} onChange={(e) => set({ additionalCosts: e.target.value })} />
        </Field>
        <Field label={t("fields.expectedProfit")} htmlFor="expectedProfit" error={fe.expectedProfit}>
          <input id="expectedProfit" className={inputCls} value={v.expectedProfit} onChange={(e) => set({ expectedProfit: e.target.value })} />
        </Field>
        <Field label={t("fields.invoiceNumber")} htmlFor="invoiceNumber" error={fe.invoiceNumber}>
          <input id="invoiceNumber" className={inputCls} value={v.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} />
        </Field>
        <Field label={t("fields.invoiceDate")} htmlFor="invoiceDate" error={fe.invoiceDate}>
          <input id="invoiceDate" type="date" className={inputCls} value={v.invoiceDate} onChange={(e) => set({ invoiceDate: e.target.value })} />
        </Field>
      </div>

      <div className={sectionCls}>{t("fields.transport")}</div>
      <div className="mb-3 flex gap-4 text-sm">
        {(["none", "existing", "new"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" name="transportMode" checked={v.transportMode === m} onChange={() => set({ transportMode: m })} />
            {m === "none" ? t("fields.noTransport") : m === "existing" ? t("fields.attachExisting") : t("fields.createNew")}
          </label>
        ))}
      </div>
      {v.transportMode === "existing" && (
        <Field label={t("fields.transportMode")} htmlFor="transportModeId" error={fe.transport}>
          <select id="transportModeId" className={inputCls} value={v.transportModeId} onChange={(e) => set({ transportModeId: e.target.value })}>
            <option value="">{t("fields.selectTransport")}</option>
            {transportOpts.map((o) => (<option key={o.id} value={o.id}>{o.number} ({o.modeType})</option>))}
          </select>
        </Field>
      )}
      {v.transportMode === "new" && (
        <div className="grid grid-cols-2 gap-x-4 rounded-lg border border-dashed border-slate-300 p-3">
          <Field label={t("fields.modeType")} htmlFor="ntModeType">
            <select id="ntModeType" className={inputCls} value={v.newTransport.modeType} onChange={(e) => setNew({ modeType: e.target.value })}>
              {MODE_TYPES.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </Field>
          <Field label={t("fields.transportNumber")} htmlFor="ntNumber">
            <input id="ntNumber" className={inputCls} value={v.newTransport.number} onChange={(e) => setNew({ number: e.target.value })} />
          </Field>
          <Field label={t("fields.fromCountry")} htmlFor="ntFrom">
            <input id="ntFrom" className={inputCls} value={v.newTransport.fromCountry} onChange={(e) => setNew({ fromCountry: e.target.value })} />
          </Field>
          <Field label={t("fields.toCountry")} htmlFor="ntTo">
            <input id="ntTo" className={inputCls} value={v.newTransport.toCountry} onChange={(e) => setNew({ toCountry: e.target.value })} />
          </Field>
          <Field label={t("fields.loadingDate")} htmlFor="ntLoad">
            <input id="ntLoad" type="date" className={inputCls} value={v.newTransport.loadingDate} onChange={(e) => setNew({ loadingDate: e.target.value })} />
          </Field>
          <Field label={t("fields.plannedArrivalDate")} htmlFor="ntArr">
            <input id="ntArr" type="date" className={inputCls} value={v.newTransport.plannedArrivalDate} onChange={(e) => setNew({ plannedArrivalDate: e.target.value })} />
          </Field>
        </div>
      )}

      {result && !result.ok && result.error && <p className="mt-3 text-sm text-red-700">{result.error}</p>}
      <SubmitRow
        pending={pending}
        saveLabel={pending ? t("actions.saving") : t("actions.save")}
        cancelHref={v.id ? `/orders/${v.id}` : "/orders"}
        cancelLabel={t("actions.cancel")}
      />
    </form>
  );
}

/** Blank initial values for the create form. */
export function blankOrderInitial(): OrderFormInitial {
  return {
    title: "", clientOrderId: "", accountId: "", carrierId: "", route: "",
    cargoDescription: "", packages: "", weightKg: "", volumeM3: "",
    incoterms: "", deliveryFormat: "", clientCharge: "", carrierCost: "",
    additionalCosts: "", additionalCostsNote: "", expectedProfit: "",
    invoiceNumber: "", invoiceDate: "",
    transportMode: "none", transportModeId: "",
    newTransport: {
      modeType: "vehicle", number: "", fromCountry: "", toCountry: "",
      route: "", loadingDate: "", plannedArrivalDate: "", totalWeightKg: "", totalVolumeM3: "",
    },
  };
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit && npm run lint` → clean.

```bash
git add src/modules/orders/order-form.tsx
git commit -m "feat: order form with finance fields and add-transport sub-flow"
```

---

### Task 10: Orders pages (list, new, detail, edit)

**Files:**
- Create: `src/modules/orders/order-detail-tabs.tsx`, `src/app/(staff)/orders/new/page.tsx`, `src/app/(staff)/orders/[id]/page.tsx`, `src/app/(staff)/orders/[id]/edit/page.tsx`, `src/modules/orders/status-control.tsx`
- Modify: `src/app/(staff)/orders/page.tsx` (replace placeholder)

- [ ] **Step 1: Replace `src/app/(staff)/orders/page.tsx` with the list + status filter**

```tsx
import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Paginator } from "@/components/ui/paginator";
import { StatusBadge } from "@/components/ui/status-badge";
import { listOrders } from "@/modules/orders/queries";
import { orderStatusEnum } from "@/db/schema";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status || undefined;
  const page = Number(sp.page) || 1;
  const t = await getTranslations();
  const format = await getFormatter();
  const { rows, total } = await listOrders({ q, status, page });

  const pill = (label: string, value: string | undefined, active: boolean) => {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (q) params.set("q", q);
    const href = params.toString() ? `/orders?${params}` : "/orders";
    return (
      <Link
        key={label}
        href={href}
        className={`rounded-full border px-3 py-1 text-xs ${active ? "border-[#1a3a5c] bg-[#1a3a5c] text-white" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title={t("nav.orders")}
        action={
          <Link href="/orders/new" className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white">
            + {t("orders.newOrder")}
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {pill(t("orders.allOrders"), undefined, !status)}
        {orderStatusEnum.enumValues.map((s) => pill(t(`status.${s}`), s, status === s))}
      </div>
      <form className="mb-3" action="/orders">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder={t("orders.searchPlaceholder")}
          className="w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3a5c]"
        />
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11.5px] text-slate-500">
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.createdAt")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.orderId")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.client")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.orderTitle")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.route")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.transport")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.clientCharge")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.status")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.lastModified")}</th>
                <th className="px-3.5 py-2.5 font-semibold">{t("fields.actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-3.5 py-8 text-center text-slate-400">{t("orders.empty")}</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500">{format.dateTime(r.createdAt, { dateStyle: "medium" })}</td>
                  <td className="px-3.5 py-2.5 font-medium text-[#1a3a5c]">{r.number}</td>
                  <td className="px-3.5 py-2.5">{r.accountTitle}</td>
                  <td className="px-3.5 py-2.5">{r.title}</td>
                  <td className="px-3.5 py-2.5">{r.route ?? "—"}</td>
                  <td className="px-3.5 py-2.5">{r.transportNumber ?? "—"}</td>
                  <td className="px-3.5 py-2.5">{r.clientCharge ? `$${Number(r.clientCharge).toLocaleString("en-US")}` : "—"}</td>
                  <td className="px-3.5 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500">{format.dateTime(r.updatedAt, { dateStyle: "medium" })}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="flex gap-2 text-xs">
                      <Link className="text-[#1a3a5c] hover:underline" href={`/orders/${r.id}`}>{t("actions.view")}</Link>
                      <Link className="text-[#1a3a5c] hover:underline" href={`/orders/${r.id}/edit`}>{t("actions.edit")}</Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Paginator page={page} total={total} basePath="/orders" params={{ ...(q ? { q } : {}), ...(status ? { status } : {}) }} />
    </div>
  );
}
```

- [ ] **Step 2: `src/app/(staff)/orders/new/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { OrderForm, blankOrderInitial } from "@/modules/orders/order-form";
import { orderFormData } from "@/modules/orders/queries";
import { transportModeOptions } from "@/modules/transport/queries";

export default async function NewOrderPage() {
  const t = await getTranslations("orders");
  const [{ accountOpts, carrierOpts }, transportOpts] = await Promise.all([
    orderFormData(),
    transportModeOptions(),
  ]);
  return (
    <div>
      <PageHeader title={t("newOrder")} />
      <OrderForm initial={blankOrderInitial()} accountOpts={accountOpts} carrierOpts={carrierOpts} transportOpts={transportOpts} />
    </div>
  );
}
```

- [ ] **Step 3: `src/modules/orders/status-control.tsx`** (client; the status dropdown on the detail page)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { changeOrderStatus } from "./actions";

const STATUSES = ["created", "received", "internal_transit", "loaded", "transit", "at_border", "at_customs", "arrived", "delivered", "closed"] as const;

export function StatusControl({ orderId, current }: { orderId: string; current: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const r = await changeOrderStatus(orderId, { status });
    setPending(false);
    if (r.ok) router.push(`/orders/${orderId}`);
  }

  return (
    <div className="flex items-center gap-2">
      <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((s) => (<option key={s} value={s}>{t(`status.${s}`)}</option>))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={pending || status === current}
        className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? t("actions.saving") : t("actions.save")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `src/modules/orders/order-detail-tabs.tsx`** (client tab switcher: Info + History)

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function OrderDetailTabs({ info, history }: { info: React.ReactNode; history: React.ReactNode }) {
  const t = useTranslations("orders");
  const [tab, setTab] = useState<"info" | "history">("info");

  const tabCls = (active: boolean) =>
    `px-3.5 py-2 text-sm border-b-2 -mb-px ${active ? "border-[#1a3a5c] font-semibold text-[#1a3a5c]" : "border-transparent text-slate-500"}`;

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button type="button" className={tabCls(tab === "info")} onClick={() => setTab("info")}>{t("tabInfo")}</button>
        <button type="button" className={tabCls(tab === "history")} onClick={() => setTab("history")}>{t("tabHistory")}</button>
      </div>
      {tab === "info" ? info : history}
    </div>
  );
}
```

- [ ] **Step 5: `src/app/(staff)/orders/[id]/page.tsx`** (detail: tabs with Info + History, status control on Info)

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { OrderDetailTabs } from "@/modules/orders/order-detail-tabs";
import { StatusControl } from "@/modules/orders/status-control";
import { getOrder } from "@/modules/orders/queries";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await getOrder(id);
  if (!data) notFound();
  const { order, accountTitle, carrierTitle, transportNumber, transportModeType, history } = data;

  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );

  const info = (
    <div className="space-y-4">
      <Card>
        <CardHeader><span className="text-sm font-semibold">{order.title}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {row(t("fields.client"), accountTitle)}
            {row(t("fields.clientOrderId"), order.clientOrderId)}
            {row(t("fields.carrier"), carrierTitle ?? "—")}
            {row(t("fields.route"), order.route)}
            {row(t("fields.transport"), transportNumber ? `${transportNumber} (${transportModeType})` : "—")}
            {row(t("fields.cargoDescription"), order.cargoDescription)}
            {row(t("fields.packages"), order.packages != null ? String(order.packages) : "—")}
            {row(t("fields.weightKg"), order.weightKg)}
            {row(t("fields.volumeM3"), order.volumeM3)}
            {row(t("fields.incoterms"), order.incoterms)}
            {row(t("fields.deliveryFormat"), order.deliveryFormat)}
            {row(t("fields.invoiceNumber"), order.invoiceNumber)}
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("nav.finance")}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            {row(t("fields.clientCharge"), order.clientCharge ? `$${order.clientCharge}` : "—")}
            {row(t("fields.carrierCost"), order.carrierCost ? `$${order.carrierCost}` : "—")}
            {row(t("fields.expectedProfit"), order.expectedProfit ? `$${order.expectedProfit}` : "—")}
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("orders.updateStatus")}</span></CardHeader>
        <CardBody><StatusControl orderId={order.id} current={order.status} /></CardBody>
      </Card>
    </div>
  );

  const historyNode = (
    <Card>
      <CardHeader><span className="text-sm font-semibold">{t("orders.deliveryHistory")}</span></CardHeader>
      <CardBody>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">{t("orders.noHistory")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between border-b border-slate-100 pb-2 last:border-0">
                <span>
                  <span className="font-medium">{h.action}</span>
                  {h.field ? ` · ${h.field}: ${h.oldValue ?? "∅"} → ${h.newValue ?? "∅"}` : ""}
                </span>
                <span className="whitespace-nowrap text-xs text-slate-400">{format.dateTime(h.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {order.number} <StatusBadge status={order.status} />
          </span>
        }
        action={
          <Link href={`/orders/${order.id}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {t("actions.edit")}
          </Link>
        }
      />
      <OrderDetailTabs info={info} history={historyNode} />
    </div>
  );
}
```

Note: `PageHeader`'s `title` prop is typed `string` in Phase 2a. Change its type to `React.ReactNode` in `src/components/ui/page-header.tsx` (the `<h1>` renders children fine) so the badge can sit beside the number. Make that one-line type change as part of this step and re-verify accounts/carriers pages still typecheck (they pass strings — compatible).

- [ ] **Step 6: `src/app/(staff)/orders/[id]/edit/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { OrderForm, blankOrderInitial } from "@/modules/orders/order-form";
import { getOrder, orderFormData } from "@/modules/orders/queries";
import { transportModeOptions } from "@/modules/transport/queries";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("orders");
  const [data, { accountOpts, carrierOpts }, transportOpts] = await Promise.all([
    getOrder(id),
    orderFormData(),
    transportModeOptions(),
  ]);
  if (!data) notFound();
  const o = data.order;

  const initial = {
    ...blankOrderInitial(),
    id: o.id,
    title: o.title,
    clientOrderId: o.clientOrderId ?? "",
    accountId: o.accountId,
    carrierId: o.carrierId ?? "",
    route: o.route ?? "",
    cargoDescription: o.cargoDescription ?? "",
    packages: o.packages != null ? String(o.packages) : "",
    weightKg: o.weightKg ?? "",
    volumeM3: o.volumeM3 ?? "",
    incoterms: o.incoterms ?? "",
    deliveryFormat: o.deliveryFormat ?? "",
    clientCharge: o.clientCharge ?? "",
    carrierCost: o.carrierCost ?? "",
    additionalCosts: o.additionalCosts ?? "",
    additionalCostsNote: o.additionalCostsNote ?? "",
    expectedProfit: o.expectedProfit ?? "",
    invoiceNumber: o.invoiceNumber ?? "",
    invoiceDate: o.invoiceDate ?? "",
    transportMode: (o.transportModeId ? "existing" : "none") as "existing" | "none",
    transportModeId: o.transportModeId ?? "",
  };

  return (
    <div>
      <PageHeader title={t("editOrder")} />
      <OrderForm initial={initial} accountOpts={accountOpts} carrierOpts={carrierOpts} transportOpts={transportOpts} />
    </div>
  );
}
```

- [ ] **Step 7: Verify end to end** (dockerized dev server up; admin cookie)

```bash
npx tsc --noEmit && npm test && npm run lint && npm run build
```

All clean. Then:
1. `curl -s -H "Cookie: $COOKIE" http://localhost:3000/orders | grep -c "New order"` → ≥1 (empty list)
2. `curl -s -H "Cookie: $COOKIE" http://localhost:3000/orders/new | grep -c "Order title"` → ≥1
3. Data-layer e2e via temp `t10check.mts` replicating createOrder for an existing account (use `listAccounts` or query an account id) attaching transport "TRK-VERIFY" from Task 6, asserting: the order gets number `ORD-<year>-001` (or next), an audit `order/created` row exists, and the order appears in `listOrders`. Then change its status via the changeOrderStatus logic and assert a `status_changed` audit row with old/new. Report the generated order number and id. LEAVE it for the browser checklist in Task 11.
4. `curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $COOKIE" http://localhost:3000/orders/nonexistent` → 404

- [ ] **Step 8: Commit**

```bash
git add "src/app/(staff)/orders" src/modules/orders/order-detail-tabs.tsx src/modules/orders/status-control.tsx src/components/ui/page-header.tsx
git commit -m "feat: orders list (status filter + search), new, detail (tabs + status), edit pages"
```

---

### Task 11: Phase close — full verification and browser checklist

- [ ] **Step 1: Full gate**

```bash
rm -rf .next
npx tsc --noEmit && npm run lint && npm test && npm run build
npx tsx --env-file=.env scripts/check-schema.mts
```

Expected: all clean; schema line shows 15 tables. Test count ≥ 28 + new (order-status, order-number formatter, transport schema, order schema) ≈ 40+.

- [ ] **Step 2: Browser checklist** (Playwright against http://localhost:3000, as admin@freightops.local / admin12345)

1. Sign in → /orders shows the table (with the order created in Task 10, plus any).
2. Click "+ New order". Fill: title "Steel pipes — Q2", select account "Baku Steel MMC", select carrier "Akın Logistics", route "Istanbul → Baku", cargo "Steel pipes", packages 24, weight 8400, volume 24, Incoterms CIP, format FTL, client charge 4200, carrier cost 2800, expected profit 1400. Choose transport = "Create new transport"; fill mode type Vehicle, number "TRK-0190". Save. EXPECT: redirect to the order profile showing number ORD-2026-NNN, status "Created" badge, the entered fields, and the transport "TRK-0190 (vehicle)".
3. On the detail Info tab, change status to "Transit", click Save. EXPECT: page shows "Transit" badge.
4. Click the History tab. EXPECT: shows a "created" entry and a "status_changed · status: created → transit" entry.
5. Go to /orders, click the "Transit" status pill. EXPECT: list filters to transit orders only (includes this one). Clear by clicking "All orders".
6. Search box: type "Steel" → the order appears; type "ZZZZ" → empty state.
7. Go to /transportation. EXPECT: "TRK-0190" card shows derived status "Transit" (from its single order), our orders 1, revenue $4,200, profit $1,400.
8. Edit the order (/orders/[id]/edit), change title, Save → redirect to profile with new title.
9. Language → RU: order/transport nav and field labels translate; data unchanged. Back to EN.
10. Close the browser.

- [ ] **Step 3: Audit + operator checks (terminal)**

```bash
docker compose exec postgres psql -U freightops -c "select entity_type, action, field, old_value, new_value from audit_log where entity_type in ('order','transport_mode') order by created_at;"
```
EXPECT: order/created, transport_mode/created (the inline-created TRK-0190), order/status_changed (status created→transit), order/updated (title). Report the rows.

```bash
OP=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"op1@freightops.local","password":"operatortest123"}' | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)
curl -s -o /dev/null -w "orders: %{http_code}\n" -H "Cookie: $OP" http://localhost:3000/orders
curl -s -o /dev/null -w "orders/new: %{http_code}\n" -H "Cookie: $OP" http://localhost:3000/orders/new
curl -s -o /dev/null -w "transportation: %{http_code}\n" -H "Cookie: $OP" http://localhost:3000/transportation
```
EXPECT: 200 / 200 / 200.

- [ ] **Step 4: Clean up phase test data** (the order/transport rows created during verification, plus any `t*check.mts` leftovers and the TRK-VERIFY transport)

```bash
# remove temp scripts if any remain
rm -f t3check.mts t5check.mts t8check.mts t10check.mts
docker compose exec postgres psql -U freightops <<'SQL'
DELETE FROM audit_log WHERE entity_type IN ('order','transport_mode');
DELETE FROM orders;
DELETE FROM transport_modes;
DELETE FROM order_counters;
SQL
git status --short
```
(Leaves accounts/carriers test data intact. order_counters reset so future demo numbering starts fresh.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: close phase 2b — orders & transportation verified" || echo "nothing to commit"
```

---

## Phase 2 complete after this

Phase 2 (core entities) is done: Accounts, Carriers, Orders, Transportation with audit/history. **Next: Phase 3 (Finance)** — payments (incoming/outcoming with the "+" repeat-add pattern), computed receivable/payable deltas and derived Paid/Not paid/Partly paid statuses, the order detail Finance tab, the Finance page, and the Dashboard (operational + financial monthly aggregates). It gets its own plan against this codebase. Actual-profit (client charge − carrier cost − additional costs) becomes a computed display value there.
