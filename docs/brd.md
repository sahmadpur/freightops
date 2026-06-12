# FreightOps — Business Requirements Document

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-06-12 |
| **Status** | Draft for client confirmation |
| **Sources** | Meeting Notes 2026-06-10 v02 (`docs/archive/`), requirements-refinement session 2026-06-12 |
| **Mock** | `docs/mock/freightops_mock.html` |

## 1. Purpose

A web-based platform for a freight forwarding company to insert and track freight transactions (deliveries) and related data, replacing the current MS Excel workflow, which causes difficulties, delays, and inconsistencies. The product's goal: guarantee proper and on-time delivery of orders from abroad, with full visibility of operational and financial state.

## 2. Users and roles

| Role | Who | Can do |
|---|---|---|
| **Admin** | Freight company management | Everything: all business operations, user & role management, audit log, settings |
| **Operator** | Freight company staff | All business operations (accounts, carriers, orders, transport, finance, documents); no user management |
| **Client** | Client company contact | Client portal only: view own orders (status, history, ETA, client-visible documents, own invoice/balance) and participate in the order comment chat. No editing; never sees carrier costs, profits, or other clients' data |

Staff invite client users from an Account profile; the invited user receives an email to set a password. Each client user is linked to exactly one Account.

## 3. Business flow

1. A staff user creates an **Account** (the client — the company that ordered). Account ID is generated automatically.
2. A staff user creates a **Carrier** (the organization or person that physically transports). Carrier ID is generated automatically.
3. A staff user creates an **Order**, selecting exactly one Account (client) and a Carrier.
4. From within the order, the user creates/assigns a **Transportation Mode** ("Add transport"). One transportation mode may carry several orders.
5. As the delivery progresses, staff update order data — primarily **status** and **financial data** (invoices, incoming and outgoing payments).
6. When delivery is complete the status is set to **Delivered**. The order may still be financially incomplete; once all financial transactions are settled, the status is set to **Closed**.

Every status change and payment is recorded and shown as the order's Delivery and Payment History.

## 4. Functional requirements

### 4.1 Main page — Orders list

- A single table where one row = one order. Columns (merged set; final tuning during testing): **Creation date, Order ID, Account, Order Title, Route, Transportation Mode, Client charge, Status, Last modified**, plus actions (**view details / edit / documents**).
- Status filter covering all 10 statuses, plus "All orders".
- Pagination.
- "New Order" action opening the full order form.

### 4.2 Orders

Each order contains:

| Field | Entry |
|---|---|
| Order number | Auto-generated (unique, immutable) |
| Order title | Manual text (brief description) |
| Client Order ID | Manual text |
| Client (Account) | Dropdown of existing accounts |
| Carrier | Dropdown of existing carriers |
| Route | Manual text |
| Transportation Mode | Assigned via "Add transport" (see 4.5) |
| Cargo description | Manual text |
| Number of packages/units | Manual number |
| Weight (kg) | Manual number |
| Volume (m³) | Manual number |
| Delivery terms | Dropdown — Incoterms 2020: EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP |
| Cargo delivery format | Dropdown: FCL, LCL, FTL, LTL |
| Order status | Dropdown — see 4.3 |
| Uploaded documents | File attachments (see 4.9) |
| Comment chat | See 4.11 |
| History | Auto-generated list of all status changes and payments (received and paid) |
| Order creation date | Auto-generated |

Financial fields per order:

| Field | Entry |
|---|---|
| Client charge (selling price) | Manual number |
| Carrier cost | Manual number |
| Additional costs | Manual number (with note text) |
| Expected profit | Manual number |
| Actual profit | **Auto**: Client charge − (Carrier cost + Additional costs) |
| Invoice number | Manual |
| Invoice date | Date picker |
| Amount receivable | Manual number |
| Amount received | Repeating entries via "+" — each payment gets an auto-stamped date |
| Receivable delta | **Auto**: Receivable − Σ(received payments) |
| Client receivable status | **Auto-derived** from payments: Paid / Not paid / Partly paid |
| Amount payable | Manual number |
| Amount paid | Repeating entries via "+" — each payment gets an auto-stamped date |
| Payable delta | **Auto**: Payable − Σ(paid payments) |
| Carrier payable status | **Auto-derived** from payments: Paid / Not paid / Partly paid |

> Decision 2026-06-12: receivable/payable statuses are computed from payment records rather than set manually, so the status can never contradict the amounts.

### 4.3 Order statuses

`Created → Received → Internal transit → Loaded → Transit → At the border → At customs → Arrived → Delivered → Closed`

- **Delivered** ends the physical delivery; the order may remain financially open.
- **Closed** requires financial data to be settled.

### 4.4 Accounts (clients) and Carriers

Account profile:

| Field | Entry |
|---|---|
| Company ID | Auto-generated (unique, immutable) |
| Company title | Manual text |
| Tax ID | Manual number |
| Contacts (1..n, added via "+") | Name/surname, phones (1..n via "+"), emails (1..n via "+") |
| Company address | Manual text |
| Order history | Auto-generated: orders with statuses, payment/received amounts, dates (populated as transactions happen) |
| Comments/notes | Manual text |
| Creation date | Auto-generated |

Carrier profile: identical shape except no Tax ID requirement in the notes (may be added if needed). Carriers get their own list page, mirroring Accounts.

> Terminology: the meeting notes use "Partner" once (email notifications); the platform uses **Carrier** consistently.

### 4.5 Transportation Mode

Created from within the order window via "Add transport". One transport mode may contain multiple orders.

| Field | Entry |
|---|---|
| Mode type | Dropdown: Vehicle, Air, Postal, Rail, Sea |
| Transport mode number | Manual |
| From / To | Country dropdowns |
| Route | Manual text |
| Loading date | Calendar picker |
| Planned arrival date | Calendar picker |
| Uploaded documents | Attachments |
| Status | **Auto-derived** from the statuses of its orders (least-advanced order status) |
| Capacity (total weight kg / volume m³) | Manual — enables share statistics |

Transportation page shows, per transport mode: status, loading date, planned arrival date, route, its orders, and share statistics (our orders / total, our weight / total, our volume / total, revenue / carrier cost / profit for our cargo).

> Decision 2026-06-12: share statistics from the mock are confirmed scope (consolidated loads may carry cargo alongside other forwarders').

### 4.6 Dashboard

Period selector by month.

**Operational information:** count of active shipments, cargo in transit, cargo at customs, unfinished orders; orders-by-status breakdown (bar). Active orders = all statuses except Delivered and Closed.

**Financial information:** total accounts receivable, total owed to carriers, revenue for period, expenses for period, expected profit from open shipments, actual profit from completed shipments.

**Financial results per month (tabular):** Total monthly revenue (Σ client charges), total monthly cost (Σ carrier costs), expected profit, actual profit, total received, total receivable, total paid, total payable — all derived from Orders.

### 4.7 Finance page

Clients summary (total receivable, total paid, outstanding, overdue) and Carriers summary (total payable, total paid, outstanding, overdue); year-to-date financial results.

### 4.8 Search and filtering

Flexible search and filtering across the platform — e.g. find a transport mode by ID, filter orders by status "At the border", find orders that are "Not paid".

### 4.9 Documents

- Upload attachments on orders and transport modes; typed (CMR, AWB, Bill of lading, Invoice, Packing list, Certificate, Waybill, Cargo photos, other).
- Documents page: all documents grouped by order, with search and type filter.
- Each document has a **visible-to-client** flag controlling portal visibility.

### 4.10 Email notifications

- Order created → notification to the Carrier contact email(s) and the client's contacts.
- Order status changed → notification to the client's contacts/users.
- New chat comment → notification to the other side (staff ↔ client).
- Emails are sent in the recipient's preferred language (EN/RU/AZ).

### 4.11 Comment chat

Each order has a comment thread. Staff and the order's client users can read and write. Messages show author and timestamp.

### 4.12 Client portal

- **My Orders**: list of the client's own orders (status, ETA, route).
- Order detail: status timeline, client-visible documents, the client's invoice/balance for that order, comment chat.
- Strict isolation: a client user sees only their own account's data; never carrier costs, profits, or other clients' orders.

### 4.13 Users & roles

Admin page to list users, assign roles, invite staff and client users (client users linked to an Account), deactivate users.

### 4.14 Audit log

Every status change, payment, and field edit is recorded: who, when, what, old → new value. Order History reads from this; the Admin "Audit Log" page shows it unfiltered with filters by user/entity/date.

### 4.15 Languages

Entire UI available in **English, Russian, Azerbaijani**; switchable at any time; user preference persisted. User-entered data is stored as typed.

## 5. Non-functional requirements

- User & role management (see 4.13).
- Audit logging (see 4.14).
- Email notifications (see 4.10).
- Cloud-server deployment; the system ships as a Docker Compose stack runnable on any cloud VPS.

## 6. Out of scope (later functionality)

- Document archive (long-term structured archive beyond the Documents page).
- Client order-request intake (clients submitting requests that staff convert to orders) — explicitly deferred 2026-06-12.

## 7. Decision log (2026-06-12 session)

1. Conflicts between meeting notes and mock resolved case by case (below).
2. Orders table uses the merged column set (notes' columns + Route, Client charge).
3. Full 10-status list is authoritative.
4. Carriers get a dedicated page mirroring Accounts.
5. Transport share statistics (mock invention) confirmed as scope.
6. Admin (Users & Roles) and Audit Log screens included in the mock.
7. Requirements maintained as this Markdown BRD; the .docx is archived as the historical source.
8. Stack: Next.js + Postgres monolith, fully Dockerized (see design spec).
9. v1 includes a client portal: view own orders + comment chat (no order requests).
10. Receivable/payable statuses are derived from payments, not manually set.
11. "Partner" normalized to "Carrier" throughout.
