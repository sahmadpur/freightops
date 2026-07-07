# Requirements 1–15 implementation — session notes (2026-07-06)

Implements the outstanding items from the client's 15-point requirement list.
Audit at the start found 3 done (3 notifications, 8 visible-to-client, 10
invoice/ACT), 3 partial, 9 not done. This session completed the remaining 12.
Plan: `~/.claude/plans/velvety-greeting-lake.md`.

## Decisions (from the user)
- **#11 currency:** FX rate per order, **USD primary**, AZN computed (`exchange_rate`
  = AZN per 1 USD); both shown via `MoneyDual`.
- **#4 portal:** keep login-based; fixed the carrier-name leak (no public lookup).
- **#2 delete:** soft delete / archive (recoverable).
- **#12/#13:** full line items (revenue + carrier cost itemized, per-line notes).
- **#14:** "Actual Profit" = amountReceivable − amountPayable (settled); "Expected
  Profit" = Σrevenue − Σcost.
- **#5 carrier invoice:** received/recorded (number + date + optional upload).
- **#15 report:** multi-select status filter + inline status edit.

## What was built (by phase)

**A — terminology / orders list / portal**
- #6 `mode_type` enum `vehicle`→`truck` (in-place rename migration) + localized
  mode labels (`transportModes` i18n namespace, shared `TRANSPORT_MODES` list).
- #7 added `container` mode.
- #1 orders list: added Client order ID, Weight, Volume, Carrier's price, and a
  paperclip indicator (`hasDocuments`), all selected in `listOrders`.
- #9 payment-status pills ("Paid by customer" / "Paid to carrier") on the list.
- #4 removed `carrierTitle` from the portal order detail.
- #5 `carrierInvoiceNumber`/`carrierInvoiceDate` + `carrier_invoice` docType.

**B — FX currency (#11)**
- `orders.exchange_rate numeric(12,4)`; `formatMoneyAzn` / `convertUsdToAzn`
  helpers (unit-tested); `MoneyDual` component; order-form rate field.

**C — finance line items (#12/#13/#14)**
- `order_finance_lines` (side revenue|cost, description, amount USD, note,
  sortOrder). `orders.clientCharge`/`carrierCost` kept as recomputed rollups.
  Migration backfills existing scalar amounts into lines and folds the old
  `additional_costs`/`additional_costs_note`/`expected_profit` columns (dropped).
- Finance-tab rewritten: Expected Profit card, editable revenue/cost line lists,
  Actual Profit (settled) card, payments. `addFinanceLine`/`deleteFinanceLine`
  recompute rollups in-transaction.
- Order create keeps quick charge/cost fields that seed the first lines; edit form
  drops the money section (managed in the Finance tab).
- Dashboard/finance now compute Actual Profit from settled amounts; invoice
  generation (`buildLines`) itemizes revenue lines and converts USD→AZN at the rate.

**D — soft delete (#2)**
- `deleted_at` on accounts, carriers, orders. `isNull(deletedAt)` filters across
  list/detail/dropdown/aggregate queries (orders, portal, finance, dashboard).
- `archive*`/`restore*` actions (accounts & carriers block while non-archived
  orders exist). `ArchiveButton` on detail pages; "Show archived" toggle on lists.

**E — reconciliation report (#15)**
- `reconciliationRows()` (per-order receivable/payable balances, excludes archived).
- Dashboard `ReconciliationReport`: Clients + Carriers tables (Order details,
  amount, paid, delta, status), multi-select status filter, inline status edit.

## Migrations added
`0005` mode_type rename+container · `0006` carrier invoice + docType · `0007`
exchange_rate · `0008` finance lines + backfill + drop columns · `0009` deleted_at.
(0005 and 0008 were hand-edited: safe enum rename, and backfill-before-drop.)

## Verification
- Typecheck clean, **135 unit tests pass**, `eslint src` clean.
- Migrations applied to the dev DB; backfill verified: all 14 demo orders migrated
  to line items with **0 rollup mismatches** (SQL check).
- Soft-delete filter verified via SQL (archive excludes, restore re-includes).
- Demo seed updated (seeds finance lines + a demo FX rate) and re-run clean.
- Staff routes compile (`/dashboard`, `/orders`, `/finance` → 307, no 500).

## Known gaps / follow-ups
- **Live UI not exercised in a browser this session**: the `app-dev` container
  exited and port 3000 was taken by another project (`pob-web`), so the new UI
  (finance line editor, reconciliation report, archive buttons, dual currency)
  was verified via typecheck/tests/data-layer checks but not clicked through.
  To run: free port 3000, `docker compose up -d app-dev`, log in, drive the flows.
- **"partners"** (item 2) is not an entity — archive implemented for clients,
  carriers, orders only. Confirm what "partners" refers to.
- tsx `@/db/schema` barrel imports fail in standalone `.mts` scripts (CJS-interop
  quirk); use relative imports in scripts. The Next app (SWC) is unaffected.
- Nothing committed yet.
