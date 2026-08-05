# Requirements 1–18 implementation — session notes (2026-08-05)

Implements the client's second requirement list (18 points) on branch `allin`.
Plan: `~/.claude/plans/shiny-churning-metcalfe.md`.

This round reshapes the order record itself rather than adding features: the
transport-mode entity is gone, the route and cargo become structured data,
orders are multi-currency, and customs clearance arrives as a new business
object alongside orders.

## Decisions (from the user)

| # | Decision |
|---|---|
| 1 | Route → two country dropdowns (flag + localized name); free-text `route` **replaced** |
| 1 | Transport type (truck/container/air/rail/sea/postal) is a **new** field; Cargo delivery format (FCL/LCL/FTL/LTL) stays separate |
| 3 | `waiting_pickup` sits between `created` and `received` |
| 4 | Order number = literal `ALL` + `YY` + `MM` + 3-digit sequence, resetting monthly |
| 6 | Rollback number = a second free-text reference, no logic attached |
| 7 | CBAR rate auto-fetched per date, editable; currencies USD, EUR, AZN, TRY, RUB (USD default) |
| 9 | Transport: UI, code **and** tables all removed |
| 10 | Customs clearance: new top-level module, standalone (no flow into order finance) |
| 13 | Arrived → notification + prominent "Create invoice" CTA; a human still clicks it |
| 15 | Auto-archive on **Closed** (not Delivered), reusing the existing `deleted_at` soft delete |
| 16 | Filters: client, carrier, from/to country, date range, transport type, payment status |

## What was built (by phase)

**0 — groundwork.** `src/lib/validation.ts` (`numericString`/`dateString`/`optText`,
rescued from the deleted transport module), `src/lib/transport-types.ts`,
`src/lib/countries.ts` (ISO-3166 codes; flags derived arithmetically, names from
`Intl.DisplayNames`, so no country names enter `messages/*.json`),
`src/lib/cargo-types.ts`, `src/lib/finance-categories.ts`. New hand-rolled UI —
`ui/combobox.tsx` (`Combobox` + creatable `MultiCombobox`, keyboard + ARIA) and
`ui/file-picker.tsx` — matching the existing dependency-free kit.

**1 — schema.** Migrations `0010` (additive: enum values, customs/fx/counter
tables, new order columns) and `0011` (hand-edited: backfills **before** drops —
`cargo_items` from `cargo_description`, and `transport_type`/`from_country`/
`to_country` adopted from each order's transport mode, countries only when they
already looked like alpha-2 codes). `order_status` and `mode_type` pgEnums are
now **built from** `src/lib/order-status.ts` / `transport-types.ts`, so the
client-safe lists and the DB can't drift.

**2 — transport removed (#9).** `src/modules/transport/` and
`src/app/(staff)/transportation/` deleted, plus every reference: order schema/
actions/queries/forms/pages, sidebar, portal, docgen, seed, tests, i18n.

**3 — order form (#1, #2, #5, #6, #8).** Rewritten in the client's field order.
Client/carrier/countries/cargo are comboboxes; agent expenses are repeatable
`{category, amount, note}` rows seeding cost finance lines; documents are picked
multi-file and uploaded after the order exists (a failure there says the order
was still created). Client order ID and all four invoice fields left the form;
carrier invoice number/date moved to the Finance tab.

**4 — numbering & workflow (#3, #4, #13, #15).** `src/lib/record-number.ts`
replaces `order-number.ts` with a generic monthly counter (`monthly_counters`,
kinds `order`→`ALL…` and `customs`→`CC…`). `changeOrderStatus` gained two
branches: **arrived** enqueues an invoice-required email to staff, **closed**
sets `deleted_at` and audits an `archived` entry.

**5 — currency (#7).** `src/lib/fx.ts` (pure, tested: `parseCbarRates`,
`aznPerUnit`, `aznRateFor`) + `src/modules/fx/` which caches the whole daily
bulletin in `fx_rates` and walks back up to 7 days on a gap. Never throws into
the request path — the rate field stays editable. `formatMoney(cents, currency)`,
`convertUsdToAzn`→`convertToAzn`, `MoneyDual` takes a currency. Cross-order
aggregates are normalized to **AZN** at each order's own rate; orders with money
but no rate are counted at face value and reported via `unratedOrders`.

**6 — customs (#10, #10.1, #12).** `src/modules/customs/` + `/customs` routes.
Order-linked (inherits client, currency, rate) or standalone. Every category
carries both **buy** and **sell**, all optional; totals and margin in
`totals.ts` (unit-tested) and mirrored in SQL for the list.

**7 — list (#11, #16).** `DataTable` gained `rowHref`: double-click **and**
Enter/Space on a focused row, so it isn't mouse-only. Order number is now a link.
URL-driven filter bar; `listOrders` grew the matching `where` clauses, including
a SQL mirror of `paymentStatus()`.

**8 — history & ledger (#14, #17).** `getOrder` joins `user`, and the new
`order-history.tsx` renders "**Admin** · changed the status · Status: Arrived →
Closed" with translated actions, field names, statuses and countries. The
Finance tab gained a chronological received/paid ledger with "recorded by" and a
running balance.

**9 — dashboard (#18).** Month selector (`?month=YYYY-MM` — the BRD 4.6
requirement never built), period results, orders by transport type, top routes,
top clients, and a customs panel, all AZN-normalized. New `RankBars` and
`MonthPicker` in `src/components/dashboard/`.

## Migrations added
`0010_additive_reshape` · `0011_drop_transport_and_legacy_order_fields`
(hand-edited to backfill before dropping). Generated in two passes because
drizzle-kit needs a TTY to disambiguate create-vs-rename when a run contains
both creates and drops.

## Verification
- **Typecheck, `eslint src scripts`, 176 unit tests** — all clean (was 135;
  +41 covering the CBAR parser, country/route labels, monthly numbering,
  multi-currency formatting, customs totals, and the reshaped order schema).
- **Migrations applied** to the dev DB against real data: all 14 pre-existing
  orders backfilled (0 empty `cargo_items`), 10 adopted transport type and
  countries from their mode, legacy columns and tables gone, `waiting_pickup`
  in the right enum position. `check-schema.mts` updated and passing.
- **Driven live in the running app** (`next dev` + Postgres + MinIO + Mailpit),
  invoking the real server actions over HTTP:
  - created orders → `ALL2608001`, then `ALL2608002` (monthly sequence);
    lowercase `de` normalized to `DE`; EUR booked at the CBAR rate 1.9610;
    agent-expense lines categorized and rolled up (120.50 + 80 = 200.50).
  - status → **arrived**: status email *and* "Invoice required" email both
    delivered via SMTP; CTA banner rendered.
  - status → **closed**: `deleted_at` set, `archived` audited, order left the
    active list and appeared under "Show archived".
  - invoice generated: 59 KB AZN PDF → MinIO → `documents` row → order patched;
    banner cleared; download returns `application/pdf` with manat text intact.
  - customs: order-linked clearance inherited its client; standalone clearance
    created; `CC2608001`/`CC2608002`; buy/sell totals correct.
  - `fx_rates` cached 38 currencies for the day; USD = 1.7000.
  - filters, tabs, and every staff route return 200; `/transportation` 404s.
  - **EN/RU/AZ** all render with zero missing-message errors; all three locale
    files hold an identical 399-key set (checked programmatically).
  - **Portal regression**: client order detail renders route/type/cargo only —
    no financial labels, amounts, or carrier names in the DOM; staff routes
    redirect (307) for a client session.

## Known gaps / follow-ups
- **Multi-file upload was exercised through the create-order and docgen paths,
  not by hand-posting the `uploadDocument` FormData action** — encoding a
  FormData server action by curl hits Next's RSC wire format, not app code. The
  server side of `uploadDocument` is unchanged; what changed is the client loop
  and `FilePicker`. Worth a click-through in a browser.
- Cargo items are stored as the **translated label** the user picked, so a list
  entered in RU stays RU when the UI switches to EN. Storing keys would need a
  migration and a creatable-value convention; deferred.
- `document_parent` keeps its now-unused `transport_mode` value (dropping an
  enum value needs a full type rewrite).
- Old orders keep their `ORD-2026-NNN` numbers; only new ones use `ALL…`.
- Portal order detail does not surface customs clearances — by decision #10 they
  are standalone and staff-facing.
