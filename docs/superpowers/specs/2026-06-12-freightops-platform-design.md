# FreightOps Platform — Technical Design

- **Date:** 2026-06-12
- **Status:** Approved in brainstorming session 2026-06-12
- **Requirements:** `docs/brd.md` (v1.0) — this spec covers the *how*; the BRD is the *what*.
- **Mock:** `docs/mock/freightops_mock.html`

## 1. Architecture

A single Next.js (App Router) monolith serving both the staff application and the client portal, backed by Postgres, with MinIO for file storage. Everything ships as one Docker Compose stack deployable to any cloud VPS.

```
docker-compose
├── app        Next.js (staff app + client portal + server actions)
├── postgres   data + sessions + audit (volume-backed)
└── minio      S3-compatible document storage (volume-backed)
```

Route groups:

- `(staff)` — Orders, Dashboard, Accounts, Carriers, Transportation, Finance, Documents, Users & Roles, Audit Log. Roles: Admin, Operator.
- `(portal)` — My Orders, order detail. Role: Client.
- `(auth)` — sign-in, password set/reset, invitation acceptance.

Mutations are Next.js server actions validated with Zod schemas shared between client forms and the server. No separate API service; if external consumers appear later, dedicated route handlers are added then.

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database | Postgres 16 (Docker volume) |
| ORM / migrations | Drizzle ORM + drizzle-kit migrations, run on container start |
| Auth | Better Auth — email+password, sessions in Postgres, roles Admin/Operator/Client |
| i18n | next-intl — EN / RU / AZ message catalogs; localized dates/numbers; user language preference persisted |
| Files | MinIO via S3 API; presigned-URL uploads/downloads (files bypass the app server); size/type validation |
| Email | nodemailer over env-configured SMTP; outbox table + async worker with ×3 retry; trilingual templates |
| Validation | Zod, shared client/server |
| UI | React + Tailwind CSS, layout per the mock (sidebar shell, tables, modals, status badges) |
| Tests | Vitest (unit), Testcontainers-Postgres (data layer), Playwright (E2E flows) |

## 3. Data model

All tables: `id`, `created_at`, `updated_at`, `created_by`. Business IDs (ORD-2026-NNN etc.) are generated once and immutable.

- **accounts** — title, tax_id, address, notes
- **carriers** — title, address, notes
- **contacts** — polymorphic child of accounts/carriers: name, phones (jsonb array), emails (jsonb array)
- **orders** — number (auto), title, client_order_id, account_id FK, carrier_id FK, transport_mode_id FK *nullable*, route, cargo_description, packages, weight_kg, volume_m3, incoterms (enum, 11 values), delivery_format (enum: FCL/LCL/FTL/LTL), status (enum, 10 values), client_charge, carrier_cost, additional_costs, additional_costs_note, expected_profit, invoice_number, invoice_date, amount_receivable, amount_payable
  - computed (not stored): actual_profit = client_charge − (carrier_cost + additional_costs); receivable/payable deltas; receivable/payable statuses (Paid / Not paid / Partly paid) derived from payments
- **payments** — order_id FK, direction (incoming/outgoing), amount, paid_at (auto-stamped, editable), note
- **transport_modes** — mode_type (enum: Vehicle/Air/Postal/Rail/Sea), number, from_country, to_country, route, loading_date, planned_arrival_date, total_weight_kg, total_volume_m3; status derived = least-advanced status among its orders
- **documents** — owner (order or transport_mode), file name, doc_type (enum: CMR/AWB/BOL/Invoice/Packing list/Certificate/Waybill/Cargo photos/Other), size, s3_key, visible_to_client (bool)
- **comments** — order_id FK, author user FK, body, timestamp
- **users** — name, email, role (admin/operator/client), account_id FK *nullable* (required for clients), language (en/ru/az), active flag (+ Better Auth tables)
- **audit_log** — user_id, entity type+id, action, field, old_value, new_value, timestamp. Written **in the same transaction** as the change. Order History tab = audit_log filtered to that order's status changes + payments.

Client-side data isolation is enforced in the data layer: every query executed for a `client` role user is scoped by their `account_id` (not just hidden in the UI).

## 4. Modules

Each module = schema + data-access functions + server actions + UI routes, independently testable:

1. **auth** — sign-in, invitations (staff invite from Account profile → email → set password), role middleware per route group
2. **accounts / carriers** — twin CRUD with contacts ("+" rows), derived order history & balances
3. **orders** — CRUD, status transitions, full order form, "Add transport" sub-flow, order detail tabs (Info, Finance, History, Documents, Comments)
4. **transport** — transport modes, derived status, share statistics
5. **finance** — payments ("+" rows), derived deltas/statuses, Finance page aggregates
6. **dashboard** — monthly operational + financial aggregates (SQL views/queries over orders & payments)
7. **documents** — presigned upload/download, type tags, client-visibility flag, Documents page
8. **chat** — per-order comment thread; polling refresh (~15 s) — no websockets
9. **notifications** — outbox pattern: triggers (order created → carrier + client contacts; status change → client; new comment → other side) enqueue; worker sends via SMTP, retries ×3, failures surfaced on an admin list
10. **admin** — Users & Roles page, Audit Log page
11. **i18n** — catalogs, language switcher, persisted preference, localized emails
12. **search** — orders/accounts/carriers/transport search incl. payment-state filters ("not paid")

## 5. Error handling

- Zod validation on every mutation; field-level errors rendered in the user's language.
- DB constraint violations mapped to friendly messages; unexpected errors logged server-side with a generic localized toast.
- Email failures never block the originating action (outbox); ×3 retry then flagged for admin.
- Uploads validate size/type before presigning; client retries transient failures.

## 6. Testing

- **Unit:** computed financials (actual profit, deltas, payment-status rollups), derived transport status, status-transition rules.
- **Data layer:** Testcontainers Postgres — CRUD, aggregates, audit-in-transaction, client scoping.
- **E2E (Playwright):** create account/carrier/order → walk statuses → add payments → close; upload + download document; comment chat both directions; **portal isolation: a client user must never see another account's order**; language switch smoke test.

## 7. Deployment

`docker-compose.yml` with app, postgres, minio; named volumes for both stores; `.env` for SMTP, secrets, base URL; migrations run on app start. Dev uses the same compose file with hot reload. Works on any cloud VPS (per BRD NFR).

## 8. Delivery phases

1. **Foundation** — scaffold, Docker stack, schema/migrations, auth + roles + invitations, i18n shell, app layout
2. **Core entities** — Accounts, Carriers, Orders CRUD + statuses, transport modes, audit/history
3. **Finance** — payments, deltas, derived statuses, Finance page, Dashboard
4. **Documents & collaboration** — MinIO uploads, Documents page, comment chat, email notifications
5. **Client portal & admin** — portal views, client invitations, Users & Roles, Audit Log, polish, full E2E suite

## 9. Out of scope (v1)

Document archive; client order-request intake; websocket realtime; external/public API; mobile app.
