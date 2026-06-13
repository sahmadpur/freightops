# FreightOps Phase 3 — Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the financial layer: decimal-safe money math, order payments (incoming/outgoing with repeat-add), computed actual profit + receivable/payable deltas + derived Paid/Not-paid/Partly-paid statuses, the order detail Finance tab, the Finance page (client/carrier balances + YTD results), and the Dashboard (operational + financial aggregates with a month selector).

**Architecture:** Same module pattern as Phase 2 — a `finance` feature module under `src/modules/finance/` (schema + queries + actions) plus pure computation helpers in `src/lib/`. All money arithmetic goes through a cents-based helper (never JS floats). Payments are audited rows; the order's `amountReceivable`/`amountPayable` are editable via an audited financials action. Receivable/payable status and deltas are **computed in queries, never stored**. Dashboard/Finance aggregates are SQL sums grouped as needed.

**Tech Stack:** Existing stack — Next.js 16 (App Router, server actions), Drizzle + Postgres, Better Auth (`requireArea`), next-intl, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-12-freightops-platform-design.md` (modules "finance" + "dashboard"), BRD §4.2 (order financial fields), §4.6 (dashboard), §4.7 (finance page). **Mock reference:** `docs/mock/freightops_mock.html` (order Finance tab, Finance page, Dashboard).

**Out of scope (later phases / descoped):**
- **"Overdue" amounts** (BRD dashboard/finance mention them) are DESCOPED — the schema has no payment due-date or terms, so overdue can't be computed. The Finance page/dashboard show *outstanding* (receivable/payable minus paid) but not overdue. Noted in the plan; revisit if a due-date field is added.
- Documents/Comments order tabs (Phase 4); client portal finance views (Phase 5); multi-currency (v1 is single-currency USD per BRD).
- No schema migration is needed — the `payments` table already exists (Phase 1) and orders already carry all financial columns.

---

## Conventions (read first)

- **Dev:** `docker compose up -d` runs the app at `http://localhost:3000` (hot reload). One-off node scripts via `npx tsx --env-file=.env <file>.mts` (top-level await needs `.mts`, not `tsx -e`). Tests/lint/tsc on the host.
- **iCloud hazard:** repo is under `~/Documents` (iCloud-synced). If `tsc` reports `.next/types/* 2.ts` duplicate-identifier errors or pages 500 with missing-manifest ENOENT, run `rm -rf .next`. If source files have `* 2.ext` siblings, delete them: `find . \( -name "* 2" -o -name "* 2.*" \) -not -path './.git/*' -not -path './node_modules/*' -delete`.
- **Money:** numeric(12,2) columns are `string | null` in/out. NEVER use JS floats for money arithmetic. Use the cents helper from Task 1 for ALL sums/comparisons. Display via its formatter.
- **Server-action security:** every `"use server"` fn starts with `await requireArea("staff")`.
- **Audit:** payment add/delete and financials edits write `recordAudit(tx, …)` in the same `db.transaction`; `auditDiff` field lists must contain ONLY columns the action actually writes (the Phase-2b false-audit lesson).
- **Client/server boundary:** never call a plain function exported from a `"use client"` module inside a server component (the Phase-2b `blankOrderInitial` lesson) — put shared non-component helpers in non-client modules.
- **Client forms:** after a successful action call `router.refresh()` ONLY when staying on the same page (the Finance tab stays put after adding a payment — here refresh is correct because we are NOT also calling router.push). Do not pair push+refresh.
- **Existing relevant code:**
  - `payments` table: id, orderId (FK cascade), direction (paymentDirectionEnum: "incoming" | "outgoing"), amount (numeric 12,2 notNull), paidAt (timestamptz notNull default now), note, createdAt, createdBy. `paymentDirectionEnum` is exported from `@/db/schema` with `.enumValues`.
  - `orders` columns incl. clientCharge, carrierCost, additionalCosts, expectedProfit, amountReceivable, amountPayable, invoiceNumber, invoiceDate, status, createdAt.
  - `orderStatusEnum.enumValues` (10 statuses); `ORDER_STATUS_RANK`/`leastAdvancedStatus` in `@/lib/order-status`.
  - `recordAudit`/`auditDiff` in `@/lib/audit`; `requireArea` in `@/lib/session`; `ActionResult` in `@/lib/forms`.
  - UI primitives: `Card/CardHeader/CardBody` (`@/components/ui/card`), `PageHeader` (`@/components/ui/page-header`, title accepts ReactNode), `StatusBadge` (`@/components/ui/status-badge`), `Field/inputCls/SubmitRow` (`@/components/ui/form`).
  - Order detail tabs: `src/modules/orders/order-detail-tabs.tsx` currently takes `{info, history}` — this phase extends it to `{info, finance, history}`.
- **Test users:** admin@freightops.local / admin12345 (admin), op1@freightops.local / operatortest123 (operator). Admin cookie for curl:

```bash
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"admin@freightops.local","password":"admin12345"}' | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)
```

- **Test data:** accounts "Verify Co", "Baku Steel MMC"; carriers "Verify Carrier Co", "Akın Logistics". There are NO orders currently (Phase 2b cleaned them). Verification tasks create their own orders/payments and clean them up; the phase-close task tracks this.

## File map

```
src/lib/money.ts                       cents-based money helpers (+ test)
src/lib/finance.ts                     actualProfit, balance, paymentStatus (pure, cents) (+ test)
src/modules/finance/schema.ts          paymentInputSchema, financialsInputSchema (+ test)
src/modules/finance/queries.ts         orderFinance(orderId), financeTotals(), dashboardData(year, month)
src/modules/finance/actions.ts         addPayment, deletePayment, updateOrderFinancials
src/modules/finance/finance-tab.tsx    client: financials editor + receivable/payable payment sections
src/modules/orders/order-detail-tabs.tsx  (modify) add a 3rd "Finance" tab
src/app/(staff)/orders/[id]/page.tsx   (modify) compute orderFinance, pass <FinanceTab/> as the finance node
src/app/(staff)/finance/page.tsx       (replace) client/carrier balances + YTD results
src/app/(staff)/dashboard/page.tsx     (replace) operational + financial aggregates + monthly table
src/components/dashboard/status-bar.tsx  orders-by-status mini bar (server component)
src/components/dashboard/month-tabs.tsx  month selector (client, links by ?month=)
messages/{en,ru,az}.json               (modify) finance, dashboard, payStatus namespaces + field keys
```

---

### Task 1: Money helper — cents-based arithmetic (TDD)

All money is numeric(12,2). Convert to integer cents for exact arithmetic (numeric(12,2) max ~10^10, ×100 = 10^12 cents, well under Number.MAX_SAFE_INTEGER 9×10^15 — exact).

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/money.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { toCents, sumCents, centsToString, formatMoney } from "./money";

describe("toCents", () => {
  it("parses numeric strings to integer cents", () => {
    expect(toCents("4200.00")).toBe(420000);
    expect(toCents("4200")).toBe(420000);
    expect(toCents("0.01")).toBe(1);
    expect(toCents("12.34")).toBe(1234);
  });
  it("treats null/empty as 0", () => {
    expect(toCents(null)).toBe(0);
    expect(toCents("")).toBe(0);
  });
  it("rounds to the nearest cent (no float drift)", () => {
    expect(toCents("0.1")).toBe(10);
    expect(toCents("1.005")).toBe(101); // 1.005 → 100.5 → rounds to 101
  });
});

describe("sumCents", () => {
  it("sums a list of numeric strings exactly", () => {
    expect(sumCents(["0.1", "0.2"])).toBe(30); // the classic float trap → exact here
    expect(sumCents(["4200.00", "2800.50", null, ""])).toBe(700050);
  });
});

describe("centsToString", () => {
  it("formats cents back to a 2-decimal string", () => {
    expect(centsToString(420000)).toBe("4200.00");
    expect(centsToString(1)).toBe("0.01");
    expect(centsToString(-2200_00)).toBe("-2200.00");
  });
});

describe("formatMoney", () => {
  it("renders a $ amount with thousands separators and 2 decimals", () => {
    expect(formatMoney(420000)).toBe("$4,200.00");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(-220000)).toBe("-$2,200.00");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './money'`

- [ ] **Step 3: Implement `src/lib/money.ts`**

```ts
/** Parse a numeric(12,2) string (or null/"") into integer cents. Rounds to nearest cent. */
export function toCents(v: string | null | undefined): number {
  if (v === null || v === undefined || v.trim() === "") return 0;
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Sum a list of numeric strings (null/empty count as 0) exactly, in cents. */
export function sumCents(values: (string | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + toCents(v), 0);
}

/** Cents → a plain 2-decimal string (no currency symbol), e.g. 420000 → "4200.00". */
export function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Cents → a display string with $ and thousands separators, e.g. 420000 → "$4,200.00". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${formatted}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass (existing 48 + 4 new describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat: add cents-based money helpers for exact financial arithmetic"
```

---

### Task 2: Finance computations — profit, balance, payment status (TDD)

**Files:**
- Create: `src/lib/finance.ts`, `src/lib/finance.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/finance.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { actualProfitCents, balance, paymentStatus } from "./finance";

describe("actualProfitCents", () => {
  it("is client charge minus carrier cost minus additional costs", () => {
    expect(actualProfitCents("4200", "2800", "0")).toBe(140000);
    expect(actualProfitCents("4200.00", "2800.00", "100.00")).toBe(130000);
  });
  it("treats null fields as 0", () => {
    expect(actualProfitCents("4200", null, null)).toBe(420000);
    expect(actualProfitCents(null, null, null)).toBe(0);
  });
});

describe("balance", () => {
  it("returns invoiced, paid, and delta in cents", () => {
    expect(balance("4200", ["2000"])).toEqual({ invoicedCents: 420000, paidCents: 200000, deltaCents: 220000 });
  });
  it("delta is negative when overpaid", () => {
    expect(balance("100", ["150"]).deltaCents).toBe(-5000);
  });
  it("handles no invoice amount and no payments", () => {
    expect(balance(null, [])).toEqual({ invoicedCents: 0, paidCents: 0, deltaCents: 0 });
  });
});

describe("paymentStatus", () => {
  it("is null when no amount is invoiced", () => {
    expect(paymentStatus(0, 0)).toBeNull();
  });
  it("is not_paid when nothing is paid", () => {
    expect(paymentStatus(420000, 0)).toBe("not_paid");
  });
  it("is partly_paid when partially paid", () => {
    expect(paymentStatus(420000, 200000)).toBe("partly_paid");
  });
  it("is paid when fully or over paid", () => {
    expect(paymentStatus(420000, 420000)).toBe("paid");
    expect(paymentStatus(420000, 500000)).toBe("paid");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './finance'`

- [ ] **Step 3: Implement `src/lib/finance.ts`**

```ts
import { toCents, sumCents } from "./money";

export type PaymentStatus = "paid" | "partly_paid" | "not_paid";

/** actual profit = client charge − carrier cost − additional costs, in cents. */
export function actualProfitCents(
  clientCharge: string | null,
  carrierCost: string | null,
  additionalCosts: string | null,
): number {
  return toCents(clientCharge) - toCents(carrierCost) - toCents(additionalCosts);
}

/** Invoiced vs paid for one side (receivable or payable). */
export function balance(
  invoiced: string | null,
  payments: (string | null)[],
): { invoicedCents: number; paidCents: number; deltaCents: number } {
  const invoicedCents = toCents(invoiced);
  const paidCents = sumCents(payments);
  return { invoicedCents, paidCents, deltaCents: invoicedCents - paidCents };
}

/** Derived status from invoiced + paid cents. Null when nothing is invoiced. */
export function paymentStatus(invoicedCents: number, paidCents: number): PaymentStatus | null {
  if (invoicedCents <= 0) return null;
  if (paidCents <= 0) return "not_paid";
  if (paidCents >= invoicedCents) return "paid";
  return "partly_paid";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat: add finance computations — actual profit, balance, payment status"
```

---

### Task 3: i18n — finance, dashboard, payStatus

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`, `messages/az.json`

- [ ] **Step 1: Add namespaces to all three catalogs** (merge new `fields` keys into the existing `fields` object; add new top-level `finance`, `dashboard`, `payStatus`). Read each file first to see the current `fields` block.

`messages/en.json` additions:

```json
{
  "finance": {
    "title": "Finance",
    "tab": "Finance",
    "actualProfit": "Actual profit",
    "receivable": "Receivable from client",
    "payable": "Payable to carrier",
    "amountReceivable": "Amount receivable",
    "amountPayable": "Amount payable",
    "received": "Received",
    "paid": "Paid",
    "delta": "Delta",
    "addPayment": "Add payment",
    "paymentAmount": "Amount",
    "paymentDate": "Date",
    "paymentNote": "Note",
    "noPayments": "No payments yet",
    "saveFinancials": "Save amounts",
    "clients": "Clients",
    "carriers": "Carriers",
    "totalReceivable": "Total receivable",
    "totalPayable": "Total payable",
    "totalReceived": "Total received",
    "totalPaid": "Total paid",
    "outstanding": "Outstanding balance",
    "ytdResults": "Financial results — {year} YTD",
    "totalRevenue": "Total revenue",
    "totalCarrierCosts": "Total carrier costs",
    "additionalExpenses": "Additional expenses",
    "expectedProfitOpen": "Expected profit (open shipments)",
    "actualProfitCompleted": "Actual profit (completed)",
    "remove": "Remove"
  },
  "dashboard": {
    "title": "Dashboard",
    "selectPeriod": "Select period",
    "operationalOverview": "Operational overview",
    "financialOverview": "Financial overview",
    "activeShipments": "Active shipments",
    "cargoInTransit": "Cargo in transit",
    "atCustoms": "At customs",
    "unfinishedOrders": "Unfinished orders",
    "revenue": "Revenue",
    "carrierCosts": "Carrier costs",
    "expectedProfit": "Expected profit",
    "actualProfit": "Actual profit",
    "accountsReceivable": "Accounts receivable",
    "owedToCarriers": "Owed to carriers",
    "ordersByStatus": "Orders by status",
    "monthlyResults": "Financial results per month — {year}",
    "month": "Month",
    "noData": "No data for this period"
  },
  "payStatus": {
    "paid": "Paid",
    "partly_paid": "Partly paid",
    "not_paid": "Not paid"
  }
}
```

`messages/ru.json` additions:

```json
{
  "finance": {
    "title": "Финансы",
    "tab": "Финансы",
    "actualProfit": "Фактическая прибыль",
    "receivable": "К получению от клиента",
    "payable": "К оплате перевозчику",
    "amountReceivable": "Сумма к получению",
    "amountPayable": "Сумма к оплате",
    "received": "Получено",
    "paid": "Оплачено",
    "delta": "Разница",
    "addPayment": "Добавить платёж",
    "paymentAmount": "Сумма",
    "paymentDate": "Дата",
    "paymentNote": "Примечание",
    "noPayments": "Платежей пока нет",
    "saveFinancials": "Сохранить суммы",
    "clients": "Клиенты",
    "carriers": "Перевозчики",
    "totalReceivable": "Всего к получению",
    "totalPayable": "Всего к оплате",
    "totalReceived": "Всего получено",
    "totalPaid": "Всего оплачено",
    "outstanding": "Непогашенный остаток",
    "ytdResults": "Финансовые результаты — {year} с начала года",
    "totalRevenue": "Общая выручка",
    "totalCarrierCosts": "Общие расходы перевозчиков",
    "additionalExpenses": "Дополнительные расходы",
    "expectedProfitOpen": "Ожидаемая прибыль (открытые)",
    "actualProfitCompleted": "Фактическая прибыль (завершённые)",
    "remove": "Удалить"
  },
  "dashboard": {
    "title": "Дашборд",
    "selectPeriod": "Выберите период",
    "operationalOverview": "Операционный обзор",
    "financialOverview": "Финансовый обзор",
    "activeShipments": "Активные отгрузки",
    "cargoInTransit": "Груз в пути",
    "atCustoms": "На таможне",
    "unfinishedOrders": "Незавершённые заказы",
    "revenue": "Выручка",
    "carrierCosts": "Расходы перевозчиков",
    "expectedProfit": "Ожидаемая прибыль",
    "actualProfit": "Фактическая прибыль",
    "accountsReceivable": "Дебиторская задолженность",
    "owedToCarriers": "Задолженность перевозчикам",
    "ordersByStatus": "Заказы по статусам",
    "monthlyResults": "Финансовые результаты по месяцам — {year}",
    "month": "Месяц",
    "noData": "Нет данных за период"
  },
  "payStatus": {
    "paid": "Оплачено",
    "partly_paid": "Частично оплачено",
    "not_paid": "Не оплачено"
  }
}
```

`messages/az.json` additions:

```json
{
  "finance": {
    "title": "Maliyyə",
    "tab": "Maliyyə",
    "actualProfit": "Faktiki mənfəət",
    "receivable": "Müştəridən alınacaq",
    "payable": "Daşıyıcıya ödəniləcək",
    "amountReceivable": "Alınacaq məbləğ",
    "amountPayable": "Ödəniləcək məbləğ",
    "received": "Alınıb",
    "paid": "Ödənilib",
    "delta": "Fərq",
    "addPayment": "Ödəniş əlavə et",
    "paymentAmount": "Məbləğ",
    "paymentDate": "Tarix",
    "paymentNote": "Qeyd",
    "noPayments": "Hələ ödəniş yoxdur",
    "saveFinancials": "Məbləğləri yadda saxla",
    "clients": "Müştərilər",
    "carriers": "Daşıyıcılar",
    "totalReceivable": "Cəmi alınacaq",
    "totalPayable": "Cəmi ödəniləcək",
    "totalReceived": "Cəmi alınıb",
    "totalPaid": "Cəmi ödənilib",
    "outstanding": "Qalıq balans",
    "ytdResults": "Maliyyə nəticələri — {year} ilin əvvəlindən",
    "totalRevenue": "Ümumi gəlir",
    "totalCarrierCosts": "Ümumi daşıyıcı xərcləri",
    "additionalExpenses": "Əlavə xərclər",
    "expectedProfitOpen": "Gözlənilən mənfəət (açıq)",
    "actualProfitCompleted": "Faktiki mənfəət (tamamlanmış)",
    "remove": "Sil"
  },
  "dashboard": {
    "title": "İdarə paneli",
    "selectPeriod": "Dövr seçin",
    "operationalOverview": "Əməliyyat icmalı",
    "financialOverview": "Maliyyə icmalı",
    "activeShipments": "Aktiv daşımalar",
    "cargoInTransit": "Yoldakı yük",
    "atCustoms": "Gömrükdə",
    "unfinishedOrders": "Tamamlanmamış sifarişlər",
    "revenue": "Gəlir",
    "carrierCosts": "Daşıyıcı xərcləri",
    "expectedProfit": "Gözlənilən mənfəət",
    "actualProfit": "Faktiki mənfəət",
    "accountsReceivable": "Debitor borcları",
    "owedToCarriers": "Daşıyıcılara borc",
    "ordersByStatus": "Statusa görə sifarişlər",
    "monthlyResults": "Aylıq maliyyə nəticələri — {year}",
    "month": "Ay",
    "noData": "Bu dövr üçün məlumat yoxdur"
  },
  "payStatus": {
    "paid": "Ödənilib",
    "partly_paid": "Qismən ödənilib",
    "not_paid": "Ödənilməyib"
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
git commit -m "feat: add finance/dashboard/payStatus i18n keys for en, ru, az"
```

---

### Task 4: Finance schema (TDD)

**Files:**
- Create: `src/modules/finance/schema.ts`, `src/modules/finance/schema.test.ts`

- [ ] **Step 1: Write the failing test `src/modules/finance/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { paymentInputSchema, financialsInputSchema } from "./schema";

describe("paymentInputSchema", () => {
  it("accepts a valid incoming payment", () => {
    const r = paymentInputSchema.safeParse({ direction: "incoming", amount: "2000.00", paidAt: "2026-06-03", note: "" });
    expect(r.success).toBe(true);
  });
  it("requires a positive amount", () => {
    expect(paymentInputSchema.safeParse({ direction: "incoming", amount: "0", paidAt: "2026-06-03" }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ direction: "incoming", amount: "-5", paidAt: "2026-06-03" }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ direction: "incoming", amount: "abc", paidAt: "2026-06-03" }).success).toBe(false);
  });
  it("rejects an unknown direction", () => {
    expect(paymentInputSchema.safeParse({ direction: "sideways", amount: "10", paidAt: "2026-06-03" }).success).toBe(false);
  });
  it("requires a date", () => {
    expect(paymentInputSchema.safeParse({ direction: "outgoing", amount: "10", paidAt: "" }).success).toBe(false);
  });
});

describe("financialsInputSchema", () => {
  it("accepts empty amounts (clearing)", () => {
    expect(financialsInputSchema.safeParse({ amountReceivable: "", amountPayable: "" }).success).toBe(true);
  });
  it("accepts numeric amounts", () => {
    expect(financialsInputSchema.safeParse({ amountReceivable: "4200", amountPayable: "2800.50" }).success).toBe(true);
  });
  it("rejects non-numeric amounts", () => {
    expect(financialsInputSchema.safeParse({ amountReceivable: "lots", amountPayable: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` → FAIL (`Cannot find module './schema'`)

- [ ] **Step 3: Implement `src/modules/finance/schema.ts`**

```ts
import { z } from "zod";
import { paymentDirectionEnum } from "@/db/schema";
import { numericString, dateString } from "@/modules/transport/schema";

/** A money amount that must be present and strictly positive (for payments). */
const positiveAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a number")
  .refine((s) => Number(s) > 0, "Must be greater than zero");

export const paymentInputSchema = z.object({
  direction: z.enum(paymentDirectionEnum.enumValues),
  amount: positiveAmount,
  paidAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

/** Order receivable/payable invoice amounts (optional, clearable). */
export const financialsInputSchema = z.object({
  amountReceivable: numericString,
  amountPayable: numericString,
});

export type FinancialsInput = z.infer<typeof financialsInputSchema>;
```

(`numericString` and `dateString` are reused from the transport schema where they were defined in Phase 2b. If `z.enum(paymentDirectionEnum.enumValues)` complains about the readonly tuple, cast `as unknown as [string, ...string[]]` — note which you used. `dateString` import is included for parity even though `paidAt` uses an inline stricter regex; if lint flags it as unused, drop the `dateString` import.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/schema.ts src/modules/finance/schema.test.ts
git commit -m "feat: add finance schemas — payment input and order financials"
```

---

### Task 5: Finance queries

**Files:**
- Create: `src/modules/finance/queries.ts`

- [ ] **Step 1: Implement `src/modules/finance/queries.ts`**

```ts
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
  // Sum invoiced amounts and payments across all orders, per direction.
  const [recvAgg] = await db
    .select({
      invoiced: sql<string>`coalesce(sum(${orders.amountReceivable}), 0)`,
    })
    .from(orders);
  const [payAgg] = await db
    .select({
      invoiced: sql<string>`coalesce(sum(${orders.amountPayable}), 0)`,
    })
    .from(orders);
  const [inAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.direction, "incoming"));
  const [outAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.direction, "outgoing"));
  const [revAgg] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${orders.clientCharge}), 0)`,
      carrierCost: sql<string>`coalesce(sum(${orders.carrierCost}), 0)`,
      additional: sql<string>`coalesce(sum(${orders.additionalCosts}), 0)`,
      expectedProfit: sql<string>`coalesce(sum(${orders.expectedProfit}), 0)`,
    })
    .from(orders);

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
  // Status counts (point-in-time).
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

  // Financial totals reuse financeTotals' YTD + receivable/payable outstanding.
  const totals = await financeTotals();

  // Monthly results for the current year, grouped by order createdAt month.
  const monthly = await db
    .select({
      month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
      revenue: sql<string>`coalesce(sum(${orders.clientCharge}), 0)`,
      carrierCost: sql<string>`coalesce(sum(${orders.carrierCost}), 0)`,
      additional: sql<string>`coalesce(sum(${orders.additionalCosts}), 0)`,
      expectedProfit: sql<string>`coalesce(sum(${orders.expectedProfit}), 0)`,
    })
    .from(orders)
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
    .orderBy(desc(sql`to_char(${orders.createdAt}, 'YYYY-MM')`));

  return {
    operational: {
      activeShipments: active,
      cargoInTransit: count("transit"),
      atCustoms: count("at_customs"),
      unfinishedOrders: count("delivered"), // delivered but not yet closed
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
```

(Note `coalesce(sum(...),0)` returns a numeric string; `toCents` parses it. Monthly groups by `createdAt` month — defensible for v1; the BRD says "per month, data source Orders".)

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint` clean. Then a query round-trip via temp `t5check.mts` (run `npx tsx --env-file=.env t5check.mts`, delete after):

```ts
import { financeTotals, dashboardData, orderFinance } from "./src/modules/finance/queries";
const ft = await financeTotals();
console.log("totals ok, receivable cents:", ft.clients.totalReceivableCents);
const dd = await dashboardData();
console.log("dashboard active:", dd.operational.activeShipments, "statusCounts:", dd.statusCounts.length);
console.log("orderFinance missing:", await orderFinance("nope"));
process.exit(0);
```

Expected: totals print (0 with no orders), `statusCounts: 10`, `orderFinance missing: null`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/queries.ts
git commit -m "feat: finance queries — order finance, finance totals, dashboard aggregates"
```

---

### Task 6: Finance actions (audited)

**Files:**
- Create: `src/modules/finance/actions.ts`

- [ ] **Step 1: Implement `src/modules/finance/actions.ts`**

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { paymentInputSchema, financialsInputSchema } from "./schema";
import type { ActionResult } from "@/lib/forms";

export async function addPayment(orderId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return "not_found" as const;
    const [row] = await tx
      .insert(payments)
      .values({
        orderId,
        direction: data.direction,
        amount: data.amount,
        paidAt: new Date(data.paidAt),
        note: data.note || null,
        createdBy: session.user.id,
      })
      .returning({ id: payments.id });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: orderId,
      action: "payment_added",
      changes: [{ field: data.direction === "incoming" ? "received" : "paid", oldValue: null, newValue: data.amount }],
    });
    return row.id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const result = await db.transaction(async (tx) => {
    const payment = await tx.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment) return "not_found" as const;
    await tx.delete(payments).where(eq(payments.id, paymentId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: payment.orderId,
      action: "payment_removed",
      changes: [{ field: payment.direction === "incoming" ? "received" : "paid", oldValue: payment.amount, newValue: null }],
    });
    return payment.orderId;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

const FINANCIAL_FIELDS = ["amountReceivable", "amountPayable"];

export async function updateOrderFinancials(orderId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = financialsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!before) return "not_found" as const;
    const after = {
      amountReceivable: data.amountReceivable || null,
      amountPayable: data.amountPayable || null,
    };
    await tx.update(orders).set(after).where(eq(orders.id, orderId));
    const changes = auditDiff(before, after, FINANCIAL_FIELDS);
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "order",
        entityId: orderId,
        action: "financials_updated",
        changes,
      });
    }
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: orderId };
}
```

(`and` import: include only if used; the actions above don't strictly need `and` — remove it from the import if lint flags it unused.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint` clean. Then an integration round-trip via temp `t6flow.mts` (replicate the action bodies since requireArea needs a session; run, assert, clean up, delete the script):

```ts
import { db } from "./src/db";
import { orders, payments, auditLog, transportModes } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "./src/lib/audit";
import { orderFinance } from "./src/modules/finance/queries";

const admin = await db.query.user.findFirst();
const acct = await db.query.accounts.findFirst();
if (!admin || !acct) throw new Error("need user + account");

// Create a minimal order with receivable 4200, payable 2800.
const [o] = await db.insert(orders).values({
  number: "ORD-TEST-FIN", title: "Finance flow", accountId: acct.id, status: "created",
  clientCharge: "4200", carrierCost: "2800", additionalCosts: "100",
  amountReceivable: "4200", amountPayable: "2800", createdBy: admin.id,
}).returning({ id: orders.id });

// Add two incoming payments + one outgoing (replicating addPayment body).
await db.insert(payments).values([
  { orderId: o.id, direction: "incoming", amount: "2000", paidAt: new Date("2026-06-03"), createdBy: admin.id },
  { orderId: o.id, direction: "incoming", amount: "1000", paidAt: new Date("2026-06-10"), createdBy: admin.id },
  { orderId: o.id, direction: "outgoing", amount: "2800", paidAt: new Date("2026-06-05"), createdBy: admin.id },
]);

const fin = await orderFinance(o.id);
console.log("actual profit cents:", fin!.actualProfitCents, "(expect 130000)");
console.log("receivable:", fin!.receivable.paidCents, "delta", fin!.receivable.deltaCents, "status", fin!.receivable.status, "(expect paid 300000, delta 120000, partly_paid)");
console.log("payable:", fin!.payable.paidCents, "delta", fin!.payable.deltaCents, "status", fin!.payable.status, "(expect 280000, delta 0, paid)");

// cleanup
await db.delete(payments).where(eq(payments.orderId, o.id));
await db.delete(orders).where(eq(orders.id, o.id));
console.log("cleaned up");
process.exit(0);
```

Expected: actual profit 130000; receivable paid 300000 delta 120000 partly_paid; payable paid 280000 delta 0 paid; cleaned up.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/actions.ts
git commit -m "feat: finance actions — add/delete payment, update order financials (audited)"
```

---

### Task 7: Finance tab on the order detail page

**Files:**
- Create: `src/modules/finance/finance-tab.tsx`
- Modify: `src/modules/orders/order-detail-tabs.tsx`, `src/app/(staff)/orders/[id]/page.tsx`

- [ ] **Step 1: Extend `src/modules/orders/order-detail-tabs.tsx` to three tabs**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function OrderDetailTabs({
  info,
  finance,
  history,
}: {
  info: React.ReactNode;
  finance: React.ReactNode;
  history: React.ReactNode;
}) {
  const t = useTranslations("orders");
  const tf = useTranslations("finance");
  const [tab, setTab] = useState<"info" | "finance" | "history">("info");

  const tabCls = (active: boolean) =>
    `px-3.5 py-2 text-sm border-b-2 -mb-px ${active ? "border-[#1a3a5c] font-semibold text-[#1a3a5c]" : "border-transparent text-slate-500"}`;

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button type="button" className={tabCls(tab === "info")} onClick={() => setTab("info")}>{t("tabInfo")}</button>
        <button type="button" className={tabCls(tab === "finance")} onClick={() => setTab("finance")}>{tf("tab")}</button>
        <button type="button" className={tabCls(tab === "history")} onClick={() => setTab("history")}>{t("tabHistory")}</button>
      </div>
      {tab === "info" ? info : tab === "finance" ? finance : history}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/modules/finance/finance-tab.tsx`** (client; financials editor + two payment sections)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, inputCls } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import type { OrderFinance, OrderPayment } from "./queries";
import { addPayment, deletePayment, updateOrderFinancials } from "./actions";

type Side = "incoming" | "outgoing";

export function FinanceTab({ orderId, finance }: { orderId: string; finance: OrderFinance }) {
  const t = useTranslations("finance");
  const router = useRouter();

  const [amountReceivable, setAmountReceivable] = useState(finance.amountReceivable ?? "");
  const [amountPayable, setAmountPayable] = useState(finance.amountPayable ?? "");
  const [savingAmounts, setSavingAmounts] = useState(false);

  async function saveAmounts() {
    setSavingAmounts(true);
    const r = await updateOrderFinancials(orderId, { amountReceivable, amountPayable });
    setSavingAmounts(false);
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("actualProfit")}</span></CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label={t("amountReceivable")} value={formatMoney(finance.clientChargeCents)} />
            <Stat label="−" value={formatMoney(finance.carrierCostCents + finance.additionalCostsCents)} />
            <Stat label={t("actualProfit")} value={formatMoney(finance.actualProfitCents)} positive={finance.actualProfitCents >= 0} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("saveFinancials")}</span></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("amountReceivable")} htmlFor="ar">
              <input id="ar" className={inputCls} value={amountReceivable} onChange={(e) => setAmountReceivable(e.target.value)} />
            </Field>
            <Field label={t("amountPayable")} htmlFor="ap">
              <input id="ap" className={inputCls} value={amountPayable} onChange={(e) => setAmountPayable(e.target.value)} />
            </Field>
          </div>
          <button
            type="button"
            onClick={saveAmounts}
            disabled={savingAmounts}
            className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("saveFinancials")}
          </button>
        </CardBody>
      </Card>

      <PaymentSection
        orderId={orderId}
        side="incoming"
        title={t("receivable")}
        invoicedCents={finance.receivable.invoicedCents}
        paidCents={finance.receivable.paidCents}
        deltaCents={finance.receivable.deltaCents}
        status={finance.receivable.status}
        payments={finance.incoming}
      />
      <PaymentSection
        orderId={orderId}
        side="outgoing"
        title={t("payable")}
        invoicedCents={finance.payable.invoicedCents}
        paidCents={finance.payable.paidCents}
        deltaCents={finance.payable.deltaCents}
        status={finance.payable.status}
        payments={finance.outgoing}
      />
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

function PaymentSection({
  orderId,
  side,
  title,
  invoicedCents,
  paidCents,
  deltaCents,
  status,
  payments,
}: {
  orderId: string;
  side: Side;
  title: string;
  invoicedCents: number;
  paidCents: number;
  deltaCents: number;
  status: "paid" | "partly_paid" | "not_paid" | null;
  payments: OrderPayment[];
}) {
  const t = useTranslations("finance");
  const tp = useTranslations("payStatus");
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setPending(true);
    setError(null);
    const r = await addPayment(orderId, { direction: side, amount, paidAt, note });
    setPending(false);
    if (r.ok) {
      setAmount(""); setPaidAt(""); setNote("");
      router.refresh();
    } else {
      setError(r.fieldErrors?.amount?.[0] ?? r.fieldErrors?.paidAt?.[0] ?? r.error ?? "Error");
    }
  }

  async function remove(id: string) {
    const r = await deletePayment(id);
    if (r.ok) router.refresh();
  }

  const statusColor =
    status === "paid" ? "bg-[#d4f2e7] text-[#085041]" :
    status === "partly_paid" ? "bg-[#fdefd1] text-[#633806]" :
    status === "not_paid" ? "bg-[#fde8df] text-[#712b13]" : "bg-slate-100 text-slate-500";

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">{title}</span>
        {status && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>{tp(status)}</span>}
      </CardHeader>
      <CardBody>
        <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
          <Stat label={side === "incoming" ? t("amountReceivable") : t("amountPayable")} value={formatMoney(invoicedCents)} />
          <Stat label={side === "incoming" ? t("received") : t("paid")} value={formatMoney(paidCents)} />
          <Stat label={t("delta")} value={formatMoney(deltaCents)} positive={deltaCents <= 0} />
        </div>

        {payments.length === 0 ? (
          <p className="mb-3 text-sm text-slate-400">{t("noPayments")}</p>
        ) : (
          <ul className="mb-3 divide-y divide-slate-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{formatMoney(Math.round(Number(p.amount) * 100))}</span>
                <span className="text-xs text-slate-400">
                  {new Date(p.paidAt).toISOString().slice(0, 10)}{p.note ? ` · ${p.note}` : ""}
                </span>
                <button type="button" onClick={() => remove(p.id)} className="text-xs text-red-700 hover:underline">
                  {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("paymentAmount")} htmlFor={`amt-${side}`}>
            <input id={`amt-${side}`} className={`${inputCls} w-32`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t("paymentDate")} htmlFor={`dt-${side}`}>
            <input id={`dt-${side}`} type="date" className={`${inputCls} w-40`} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label={t("paymentNote")} htmlFor={`nt-${side}`}>
            <input id={`nt-${side}`} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="mb-3.5 rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + {t("addPayment")}
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 3: Wire the Finance tab into `src/app/(staff)/orders/[id]/page.tsx`**

Add the import and compute the finance data, then pass a `finance` node to `OrderDetailTabs`. Specifically:

Add imports near the existing ones:

```tsx
import { orderFinance } from "@/modules/finance/queries";
import { FinanceTab } from "@/modules/finance/finance-tab";
```

After `const data = await getOrder(id); if (!data) notFound();` add:

```tsx
  const finance = await orderFinance(id);
```

Remove the now-redundant Finance summary card from the `info` node (the small 3-stat Finance `Card` added in Phase 2b that showed clientCharge/carrierCost/expectedProfit) — that detail now lives in the Finance tab. Leave the rest of `info` as-is.

Build the finance node and pass all three to the tabs component. Replace the final `<OrderDetailTabs info={info} history={historyNode} />` with:

```tsx
      <OrderDetailTabs
        info={info}
        finance={finance ? <FinanceTab orderId={order.id} finance={finance} /> : null}
        history={historyNode}
      />
```

- [ ] **Step 4: Verify**

```bash
rm -rf .next
npx tsc --noEmit && npm test && npm run lint && npm run build
```

All clean (52+ tests). Server-action interactions are exercised in the browser checklist (Task 10); here confirm the detail page still renders for an order. Create a quick order via temp `t7check.mts` (insert an order with amountReceivable/amountPayable; capture id; delete after), then with the admin cookie:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE" "http://localhost:3000/orders/<id>"
```

Expected: 200. Clean up the order row.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/finance-tab.tsx src/modules/orders/order-detail-tabs.tsx "src/app/(staff)/orders/[id]/page.tsx"
git commit -m "feat: order Finance tab — financials editor, receivable/payable payments with derived status"
```

---

### Task 8: Finance page

**Files:**
- Modify: `src/app/(staff)/finance/page.tsx` (replace placeholder)

- [ ] **Step 1: Replace `src/app/(staff)/finance/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { financeTotals } from "@/modules/finance/queries";
import { formatMoney } from "@/lib/money";

export default async function FinancePage() {
  const t = await getTranslations("finance");
  const totals = await financeTotals();
  const year = new Date().getFullYear();

  const fin = (label: string, cents: number, tone?: "pos" | "neg") => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span>{label}</span>
      <span className={`font-semibold ${tone === "pos" ? "text-[#3b6d11]" : tone === "neg" ? "text-[#a32d2d]" : ""}`}>
        {formatMoney(cents)}
      </span>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={t("title")} />
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("clients")}</span></CardHeader>
          <CardBody>
            {fin(t("totalReceivable"), totals.clients.totalReceivableCents)}
            {fin(t("totalReceived"), totals.clients.totalReceivedCents, "pos")}
            {fin(t("outstanding"), totals.clients.outstandingCents, "neg")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("carriers")}</span></CardHeader>
          <CardBody>
            {fin(t("totalPayable"), totals.carriers.totalPayableCents)}
            {fin(t("totalPaid"), totals.carriers.totalPaidCents, "pos")}
            {fin(t("outstanding"), totals.carriers.outstandingCents, "neg")}
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><span className="text-sm font-semibold">{t("ytdResults", { year })}</span></CardHeader>
        <CardBody>
          {fin(t("totalRevenue"), totals.ytd.revenueCents, "pos")}
          {fin(t("totalCarrierCosts"), -totals.ytd.carrierCostsCents, "neg")}
          {fin(t("additionalExpenses"), -totals.ytd.additionalCents, "neg")}
          {fin(t("expectedProfitOpen"), totals.ytd.expectedProfitCents, "pos")}
          {fin(t("actualProfitCompleted"), totals.ytd.actualProfitCents, "pos")}
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint && npm run build` clean. With admin cookie: `curl -s -H "Cookie: $COOKIE" http://localhost:3000/finance | grep -c "Total receivable"` → ≥1. Unauthenticated → 307.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(staff)/finance/page.tsx"
git commit -m "feat: finance page — client/carrier balances and YTD results"
```

---

### Task 9: Dashboard page

**Files:**
- Create: `src/components/dashboard/status-bar.tsx`
- Modify: `src/app/(staff)/dashboard/page.tsx` (replace placeholder)

- [ ] **Step 1: Create `src/components/dashboard/status-bar.tsx`** (orders-by-status mini bar; server component)

```tsx
import { StatusBadge } from "@/components/ui/status-badge";

const SEGMENT_COLORS: Record<string, string> = {
  created: "#b5d4f4",
  received: "#c5bdf0",
  internal_transit: "#a8d8ed",
  loaded: "#9fe1cb",
  transit: "#fac775",
  at_border: "#f5c4b3",
  at_customs: "#f4c0d1",
  arrived: "#c0dd97",
  delivered: "#5dcaa5",
  closed: "#c4c4c4",
};

export function StatusBar({ counts }: { counts: { status: string; count: number }[] }) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded">
        {total === 0 ? (
          <div className="h-full w-full bg-slate-100" />
        ) : (
          counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <div
                key={c.status}
                style={{ width: `${(c.count / total) * 100}%`, background: SEGMENT_COLORS[c.status] ?? "#ccc" }}
                title={`${c.status}: ${c.count}`}
              />
            ))
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {counts.filter((c) => c.count > 0).map((c) => (
          <span key={c.status} className="flex items-center gap-1.5 text-xs">
            <StatusBadge status={c.status} /> {c.count}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/(staff)/dashboard/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBar } from "@/components/dashboard/status-bar";
import { dashboardData } from "@/modules/finance/queries";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const d = await dashboardData();
  const year = new Date().getFullYear();

  const metric = (label: string, value: string | number, sub?: string) => (
    <Card>
      <CardBody>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      </CardBody>
    </Card>
  );

  const fin = (label: string, cents: number, tone?: "pos" | "neg") => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span>{label}</span>
      <span className={`font-semibold ${tone === "pos" ? "text-[#3b6d11]" : tone === "neg" ? "text-[#a32d2d]" : ""}`}>
        {formatMoney(cents)}
      </span>
    </div>
  );

  return (
    <div>
      <PageHeader title={t("title")} />

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("operationalOverview")}</div>
      <div className="mb-5 grid grid-cols-4 gap-3">
        {metric(t("activeShipments"), d.operational.activeShipments)}
        {metric(t("cargoInTransit"), d.operational.cargoInTransit)}
        {metric(t("atCustoms"), d.operational.atCustoms)}
        {metric(t("unfinishedOrders"), d.operational.unfinishedOrders)}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("financialOverview")}</span></CardHeader>
          <CardBody>
            {fin(t("revenue"), d.financial.ytd.revenueCents, "pos")}
            {fin(t("carrierCosts"), -d.financial.ytd.carrierCostsCents, "neg")}
            {fin(t("expectedProfit"), d.financial.ytd.expectedProfitCents, "pos")}
            {fin(t("actualProfit"), d.financial.ytd.actualProfitCents, "pos")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><span className="text-sm font-semibold">{t("financialOverview")}</span></CardHeader>
          <CardBody>
            {fin(t("accountsReceivable"), d.financial.clients.outstandingCents)}
            {fin(t("owedToCarriers"), d.financial.carriers.outstandingCents, "neg")}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader><span className="text-sm font-semibold">{t("ordersByStatus")}</span></CardHeader>
        <CardBody><StatusBar counts={d.statusCounts} /></CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("monthlyResults", { year })}</span></CardHeader>
        <CardBody>
          {d.monthly.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-4 font-semibold">{t("month")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("revenue")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("carrierCosts")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("expectedProfit")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("actualProfit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.monthly.map((m) => (
                    <tr key={m.month} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4">{formatMoney(m.revenueCents)}</td>
                      <td className="py-2 pr-4">{formatMoney(m.carrierCostCents)}</td>
                      <td className="py-2 pr-4">{formatMoney(m.expectedProfitCents)}</td>
                      <td className="py-2 pr-4">{formatMoney(m.actualProfitCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

(Scope note: the mock shows a month-tab period selector. For v1 the dashboard shows current-state operational metrics + YTD financials + a per-month results table for the year — faithful to BRD §4.6 "Financial Results per month (tabular form)" and "Operational Results". A clickable month filter is deferred; the monthly table already presents every month, which satisfies the per-month requirement.)

- [ ] **Step 3: Verify** — `rm -rf .next && npx tsc --noEmit && npm test && npm run lint && npm run build` clean. With admin cookie: `curl -s -H "Cookie: $COOKIE" http://localhost:3000/dashboard | grep -c "Active shipments"` → ≥1. Unauthenticated → 307.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/status-bar.tsx "src/app/(staff)/dashboard/page.tsx"
git commit -m "feat: dashboard — operational metrics, financial overview, status bar, monthly results"
```

---

### Task 10: Phase close — full verification and browser checklist

- [ ] **Step 1: Full gate**

```bash
rm -rf .next
npx tsc --noEmit && npm run lint && npm test && npm run build
npx tsx --env-file=.env scripts/check-schema.mts
```

Expected: all clean; schema line shows 15 tables. Test count ≥ 48 + new (money 4, finance 3, finance schema 2) ≈ 57+.

- [ ] **Step 2: Browser checklist** (Playwright against http://localhost:3000, admin@freightops.local / admin12345)

1. Sign in. Create an order (Orders → New order): title "Finance demo", account "Baku Steel MMC", carrier "Akın Logistics", client charge 4200, carrier cost 2800, additional costs 100, expected profit 1300, transport "No transport". Save → lands on the order detail.
2. Click the **Finance** tab. EXPECT: an actual-profit card showing $1,300.00 (4200 − 2800 − 100). Set Amount receivable 4200, Amount payable 2800, click "Save amounts".
3. In "Receivable from client": add a payment amount 2000, date today. EXPECT: list shows the $2,000 payment, Received $2,000.00, Delta $2,200.00, status badge "Partly paid".
4. Add a second receivable payment 2200. EXPECT: Received $4,200.00, Delta $0.00, status "Paid".
5. In "Payable to carrier": add a payment 2800 today. EXPECT: status "Paid", Delta $0.00.
6. Remove one receivable payment. EXPECT: status returns to "Partly paid", delta recomputes.
7. Click the **History** tab. EXPECT: entries for payment_added (×3 originally), payment_removed, financials_updated, plus created.
8. Go to **Finance** (nav). EXPECT: Clients total receivable $4,200.00, received reflects current payments, outstanding computed; Carriers total payable $2,800.00, paid $2,800.00, outstanding $0.00; YTD revenue $4,200.00, actual profit $1,300.00.
9. Go to **Dashboard**. EXPECT: Active shipments ≥1 (the order is "created"), orders-by-status bar shows a "Created" segment, financial overview shows revenue $4,200.00 and actual profit $1,300.00, monthly results table has a row for the current month.
10. Switch language to RU → finance/dashboard labels translate (Финансы, Дашборд, Не оплачено etc.); back to EN.
11. Close the browser.

- [ ] **Step 3: Audit + operator checks (terminal)**

```bash
docker compose exec postgres psql -U freightops -c "select entity_type, action, field, old_value, new_value from audit_log where action in ('payment_added','payment_removed','financials_updated') order by created_at;"
```
EXPECT: payment_added rows (field received/paid, newValue the amount), a payment_removed row, financials_updated (amountReceivable/amountPayable). Report the rows.

```bash
OP=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"op1@freightops.local","password":"operatortest123"}' | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)
for p in finance dashboard; do printf "  /%s: " "$p"; curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $OP" "http://localhost:3000/$p"; done
```
EXPECT: 200 / 200.

- [ ] **Step 4: Clean up phase test data**

```bash
rm -f t5check.mts t6flow.mts t7check.mts
docker compose exec postgres psql -U freightops <<'SQL'
DELETE FROM audit_log WHERE entity_type = 'order';
DELETE FROM payments;
DELETE FROM orders;
DELETE FROM order_counters;
SQL
# Remove any iCloud conflict copies that appeared during the run
find . \( -name "* 2" -o -name "* 2.*" \) -not -path "./.git/*" -not -path "./node_modules/*" -delete
git status --short
```
(Leaves accounts/carriers intact; resets order numbering.)

- [ ] **Step 5: Commit any leftover & close**

```bash
git add -A && git diff --cached --quiet && echo "nothing to commit" || git commit -m "chore: close phase 3 — finance verified"
```

---

## Phase 3 complete after this

Finance is done: payments (in/out, repeat-add, audited), computed actual profit + receivable/payable deltas + derived Paid/Not-paid/Partly-paid statuses, the order Finance tab, the Finance page, and the Dashboard. **Next: Phase 4 (Documents & collaboration)** — MinIO presigned upload/download, the Documents page + order Documents tab (with the client-visible flag), the order comment chat, and the email-notification outbox + SMTP (invitation links become real emails). Out of this phase and worth picking up later: a payment due-date field would unlock "overdue" reporting on the Finance page/Dashboard; a clickable month filter on the Dashboard.
