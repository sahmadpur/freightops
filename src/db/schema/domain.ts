import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userRoleEnum } from "./enums";
import { user } from "./auth";
// Relative imports: drizzle-kit and the .mts seed scripts load these files
// outside Next's bundler, where the "@/" alias isn't resolved.
import { ORDER_STATUSES } from "../../lib/order-status";
import { TRANSPORT_TYPES } from "../../lib/transport-types";
import { REQUEST_STATUSES } from "../../lib/request-status";
import { LOST_REASONS } from "../../lib/lost-reason";
import { LEAD_SOURCES } from "../../lib/lead-source";
import { TASK_TYPES } from "../../lib/task-types";
import { INCOTERMS } from "../../lib/incoterms";
import {
  CONTAINER_TYPES,
  ROUTING_PREFERENCES,
  STACKABLE_VALUES,
  TRANSPORT_FAMILIES,
  TRANSPORT_SUBTYPES,
  VEHICLE_TYPES,
  WAGON_TYPES,
} from "../../lib/transport-matrix";

export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const incotermsEnum = pgEnum("incoterms", INCOTERMS);
export const deliveryFormatEnum = pgEnum("delivery_format", ["FCL", "LCL", "FTL", "LTL"]);
// How the cargo moves. Formerly the transport-mode entity's type; since that
// entity was removed the value lives directly on the order as `transport_type`.
// The enum name stays `mode_type` — renaming a live pg type buys nothing.
export const modeTypeEnum = pgEnum("mode_type", TRANSPORT_TYPES);
export const paymentDirectionEnum = pgEnum("payment_direction", ["incoming", "outgoing"]);
export const financeLineSideEnum = pgEnum("finance_line_side", ["revenue", "cost"]);
// Categories for agent-expense (cost) finance lines. Revenue lines default to "other".
export const financeCategoryEnum = pgEnum("finance_category", [
  "customs",
  "broker",
  "terminal",
  "warehouse",
  "loading",
  "transport",
  "insurance",
  "certification",
  "demurrage",
  "bank_fee",
  "other",
]);
export const customsItemCategoryEnum = pgEnum("customs_item_category", [
  "documentation_fee",
  "declaration_main_page",
  "declaration_additional_page",
  "short_declaration",
  "broker_fee",
  "inspector_fee",
  "handling",
  "terminal",
  "delivery",
]);
export const docTypeEnum = pgEnum("doc_type", [
  "cmr",
  "awb",
  "bill_of_lading",
  "invoice",
  "carrier_invoice",
  "packing_list",
  "certificate",
  "act",
  "waybill",
  "cargo_photos",
  "other",
]);
// "carrier" is dead since carriers merged into accounts (migration 0019), but
// stays in the pg enum: dropping an enum value requires a full type rewrite.
export const contactParentEnum = pgEnum("contact_parent", ["account", "carrier"]);
// "transport_mode" is retired but kept in the enum: dropping a value requires a
// full type rewrite and no rows reference it any more.
export const documentParentEnum = pgEnum("document_parent", [
  "order",
  "transport_mode",
  "customs_clearance",
  "request",
]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);
/** How a contact prefers to be reached. Used as a hint on the request form. */
export const preferredChannelEnum = pgEnum("preferred_channel", [
  "email",
  "phone",
  "whatsapp",
  "other",
]);

// --- The commercial (Request) side. Values come from src/lib/*, which the form
// --- imports too, so the database and the UI can never disagree.
export const requestStatusEnum = pgEnum("request_status", REQUEST_STATUSES);
export const lostReasonEnum = pgEnum("lost_reason", LOST_REASONS);
export const leadSourceEnum = pgEnum("lead_source", LEAD_SOURCES);

// --- Structured transport (specification §8 / Appendix A).
export const transportFamilyEnum = pgEnum("transport_family", TRANSPORT_FAMILIES);
export const transportSubtypeEnum = pgEnum("transport_subtype", TRANSPORT_SUBTYPES);
export const vehicleTypeEnum = pgEnum("vehicle_type", VEHICLE_TYPES);
export const containerTypeEnum = pgEnum("container_type", CONTAINER_TYPES);
export const wagonTypeEnum = pgEnum("wagon_type", WAGON_TYPES);
export const routingPreferenceEnum = pgEnum("routing_preference", ROUTING_PREFERENCES);
export const stackableEnum = pgEnum("stackable", STACKABLE_VALUES);

/**
 * Requests and orders carry the same shipment payload, and converting a request
 * copies it (§14). Legs and cargo therefore hang off either, polymorphically —
 * same pattern as `documents`, no DB-level FK, app-level cascade.
 */
export const shipmentParentEnum = pgEnum("shipment_parent", ["request", "order"]);

const id = () => text("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());
const createdBy = () => text("created_by").references(() => user.id);

export const accounts = pgTable("accounts", {
  id: id(),
  title: text("title").notNull(),
  /**
   * Which hats this company wears — client / agent / carrier / supplier /
   * customs_broker / other (src/lib/company-roles.ts), several at once. A
   * text[] on the row rather than a join table: the spec's "flexible model".
   */
  roles: text("roles").array().notNull().default(sql`'{client}'::text[]`),
  taxId: text("tax_id"),
  address: text("address"),
  // ISO 3166-1 alpha-2, same convention as the route columns.
  country: text("country"),
  city: text("city"),
  phones: jsonb("phones").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  /**
   * Email domains this company owns ("bosch.com"), lower-cased and without the
   * "@". The fallback key for matching an inbound sender to a company when no
   * contact email matches exactly (spec §17.4).
   */
  emailDomains: jsonb("email_domains").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  notes: text("notes"),
  // Soft delete: archived rows are hidden from lists but retained (recoverable).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
});

// Polymorphic parent — no DB-level FK; application code must delete children when deleting the parent.
//
// Ids are STABLE: the account/carrier forms upsert contacts by id rather than
// delete-and-reinsert, because requests.contact_id references this table.
export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    parentType: contactParentEnum("parent_type").notNull(),
    parentId: text("parent_id").notNull(),
    name: text("name").notNull(),
    /** Job title, shown next to the name when picking a contact person. */
    position: text("position"),
    phones: jsonb("phones").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    emails: jsonb("emails").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    whatsapp: text("whatsapp"),
    preferredChannel: preferredChannelEnum("preferred_channel"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_parent_idx").on(t.parentType, t.parentId)],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: text("number").notNull().unique(),
    title: text("title").notNull(),
    /** Free-text secondary reference supplied by the desk. No logic attached. */
    rollbackNumber: text("rollback_number"),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    // The column keeps its name; since 0019 it points at accounts (role "carrier").
    carrierId: text("carrier_id").references(() => accounts.id),
    // Where the order came from (§26). Null on manually created orders. The
    // callbacks are annotated because requests/quotations are declared below.
    requestId: text("request_id").references((): AnyPgColumn => requests.id),
    quotationId: text("quotation_id").references((): AnyPgColumn => quotations.id),
    contactId: text("contact_id").references(() => contacts.id),
    responsibleUserId: text("responsible_user_id").references(() => user.id),
    cargoReadyDate: date("cargo_ready_date"),
    requestedDeliveryDate: date("requested_delivery_date"),
    specialInstructions: text("special_instructions"),
    transportType: modeTypeEnum("transport_type"),
    // Route is structured: ISO 3166-1 alpha-2 country codes, rendered with flags.
    // The authoritative route is the order's `transport_legs`; these stay as the
    // denormalized pair the list, filters and dashboard aggregate on.
    fromCountry: text("from_country"),
    toCountry: text("to_country"),
    fromCity: text("from_city"),
    toCity: text("to_city"),
    /** Cargo description as a multi-select of free-form labels. */
    cargoItems: jsonb("cargo_items").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    packages: integer("packages"),
    weightKg: numeric("weight_kg", { precision: 12, scale: 2 }),
    volumeM3: numeric("volume_m3", { precision: 12, scale: 2 }),
    incoterms: incotermsEnum("incoterms"),
    deliveryFormat: deliveryFormatEnum("delivery_format"),
    status: orderStatusEnum("status").notNull().default("created"),
    // The currency every amount on this order is denominated in (ORDER_CURRENCIES
    // in src/lib/fx.ts). Rollups of order_finance_lines, recomputed on any line
    // change: clientCharge = Σ revenue lines, carrierCost = Σ cost lines.
    currency: text("currency").notNull().default("USD"),
    clientCharge: numeric("client_charge", { precision: 12, scale: 2 }),
    carrierCost: numeric("carrier_cost", { precision: 12, scale: 2 }),
    // FX rate: AZN per 1 unit of `currency`, seeded from the CBAR bulletin for
    // the order's date and editable. AZN totals are computed, never stored.
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 4 }),
    // Customer payment invoice (the one the app generates / bills the client).
    invoiceNumber: text("invoice_number"),
    invoiceDate: date("invoice_date"),
    // Carrier invoice — the invoice received FROM the carrier (recorded, not generated).
    carrierInvoiceNumber: text("carrier_invoice_number"),
    carrierInvoiceDate: date("carrier_invoice_date"),
    actNumber: text("act_number"),
    actDate: date("act_date"),
    amountReceivable: numeric("amount_receivable", { precision: 12, scale: 2 }),
    amountPayable: numeric("amount_payable", { precision: 12, scale: 2 }),
    // KPI timestamps (§23). The order's own two; the rest live on the request.
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Soft delete: archived orders are hidden from lists/aggregates but retained.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [
    index("orders_account_id_idx").on(t.accountId),
    index("orders_status_idx").on(t.status),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    direction: paymentDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // App layer must pass the real payment value date; defaultNow() is a fallback for quick entry, not a substitute.
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    createdAt: createdAt(),
    createdBy: createdBy(),
  },
  (t) => [index("payments_order_id_idx").on(t.orderId)],
);

// Itemized revenue / agent-expense lines for an order. Their sums are cached on
// orders.clientCharge (revenue) and orders.carrierCost (cost). Amounts are in
// the parent order's currency.
export const orderFinanceLines = pgTable(
  "order_finance_lines",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    side: financeLineSideEnum("side").notNull(),
    // Meaningful for cost ("agent expenses") lines; revenue lines stay "other".
    category: financeCategoryEnum("category").notNull().default("other"),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    createdBy: createdBy(),
  },
  (t) => [index("order_finance_lines_order_id_idx").on(t.orderId)],
);

// Polymorphic parent — no DB-level FK; application code must delete children when deleting the parent.
export const documents = pgTable("documents", {
  id: id(),
  parentType: documentParentEnum("parent_type").notNull(),
  parentId: text("parent_id").notNull(),
  fileName: text("file_name").notNull(),
  docType: docTypeEnum("doc_type").notNull().default("other"),
  // Currency of a generated invoice/ACT (chosen per document). Null for
  // uploaded documents and for invoices/ACTs generated before this field.
  currency: text("currency"),
  sizeBytes: integer("size_bytes"),
  s3Key: text("s3_key").notNull(),
  visibleToClient: boolean("visible_to_client").notNull().default(false),
  createdAt: createdAt(),
  createdBy: createdBy(),
});

export const comments = pgTable(
  "comments",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_order_id_idx").on(t.orderId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    userId: text("user_id").references(() => user.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    field: text("field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entityType, t.entityId)],
);

export const invitations = pgTable("invitations", {
  id: id(),
  email: text("email").notNull(),
  role: userRoleEnum("role").notNull(),
  accountId: text("account_id").references(() => accounts.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  invitedBy: text("invited_by").references(() => user.id),
  createdAt: createdAt(),
});

// Per-month sequences for human-readable record numbers, one row per
// (kind, year, month). kind "order" → ALL2607001, kind "customs" → CC2607001.
// See src/lib/record-number.ts.
export const monthlyCounters = pgTable(
  "monthly_counters",
  {
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kind, t.year, t.month] })],
);

// Per-year sequences for the CRM's record numbers, one row per (kind, year).
// kind "request" → REQ-2026-0145, kind "order" → ORD-2026-0087. Same row-lock
// upsert as monthlyCounters. See src/lib/record-number.ts.
export const annualCounters = pgTable(
  "annual_counters",
  {
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kind, t.year] })],
);

export const docCounterKindEnum = pgEnum("doc_counter_kind", ["invoice", "act"]);

// Per-year sequences for generated documents (invoice / ACT numbers), same
// row-lock upsert pattern as monthlyCounters. See src/lib/doc-number.ts.
export const docCounters = pgTable(
  "doc_counters",
  {
    kind: docCounterKindEnum("kind").notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kind, t.year] })],
);

// Cached CBAR (cbar.az) daily bulletin: one row per (date, currency). The
// bulletin is immutable once published, so a row is fetched once and reused
// forever. `value` is AZN for `nominal` units of `code`.
export const fxRates = pgTable(
  "fx_rates",
  {
    rateDate: date("rate_date").notNull(),
    code: text("code").notNull(),
    nominal: integer("nominal").notNull(),
    value: numeric("value", { precision: 12, scale: 4 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.rateDate, t.code] })],
);

// Customs clearance: a standalone billable job. It may reference an order, or
// stand on its own for a client. Its money never flows into order finance.
export const customsClearances = pgTable(
  "customs_clearances",
  {
    id: id(),
    number: text("number").notNull().unique(),
    orderId: text("order_id").references(() => orders.id),
    accountId: text("account_id").references(() => accounts.id),
    declarationNumber: text("declaration_number"),
    description: text("description"),
    currency: text("currency").notNull().default("USD"),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 4 }),
    clearedAt: date("cleared_at"),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [index("customs_clearances_order_id_idx").on(t.orderId)],
);

// Every category carries both a buy (what we pay) and a sell (what we charge)
// amount; both are optional — nothing on a clearance is mandatory.
export const customsClearanceItems = pgTable(
  "customs_clearance_items",
  {
    id: id(),
    clearanceId: text("clearance_id")
      .notNull()
      .references(() => customsClearances.id, { onDelete: "cascade" }),
    category: customsItemCategoryEnum("category").notNull(),
    buyAmount: numeric("buy_amount", { precision: 12, scale: 2 }),
    sellAmount: numeric("sell_amount", { precision: 12, scale: 2 }),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("customs_clearance_items_clearance_id_idx").on(t.clearanceId)],
);

/**
 * A commercial enquiry. Every inbound approach about a shipment starts here,
 * whatever channel it arrived through (§2, §6.1). A request either goes through
 * a quotation and is won, or is turned straight into a direct order; either way
 * it stays in the system with a link to the order it produced (§3, §14).
 *
 * Route, transport and cargo are NOT columns here — they live in
 * `transport_legs` and `cargo_details`, so converting to an order is a
 * re-parent rather than a copy of forty fields.
 */
export const requests = pgTable(
  "requests",
  {
    id: id(),
    /** REQ-2026-0145. Allocated from `annual_counters`; never edited. */
    number: text("number").notNull().unique(),
    /** "BOSCH | Hamburg → Baku | Road FTL" — generated, then editable (§6.2). */
    title: text("title").notNull(),
    /** The client's own email subject, kept verbatim so the thread stays findable. */
    emailSubject: text("email_subject"),

    // Nullable: a request may be saved as a draft before the company is known
    // ("temporary lead", §24). Contact ids are stable — see sync-contacts.ts.
    accountId: text("account_id").references(() => accounts.id),
    contactId: text("contact_id").references(() => contacts.id),
    responsibleUserId: text("responsible_user_id")
      .notNull()
      .references(() => user.id),

    leadSource: leadSourceEnum("lead_source").notNull(),
    /** The agent or partner company that referred this enquiry, when there is one. */
    sourceAgentAccountId: text("source_agent_account_id").references(() => accounts.id),
    /** Call summary / channel note, for sources with no written original (§6.3). */
    sourceNote: text("source_note"),

    /** road | sea | rail | air | multimodal. The legs carry the detail. */
    transportFamily: transportFamilyEnum("transport_family"),

    incoterms: incotermsEnum("incoterms"),
    /** "Hamburg" in "EXW Hamburg" — only meaningful once an incoterm is chosen. */
    incotermPlace: text("incoterm_place"),
    cargoReadyDate: date("cargo_ready_date"),
    requestedDeliveryDate: date("requested_delivery_date"),
    specialInstructions: text("special_instructions"),

    status: requestStatusEnum("status").notNull().default("new"),
    /** Mandatory when the status is `lost`; `other` also requires the note (§12). */
    lostReason: lostReasonEnum("lost_reason"),
    lostReasonNote: text("lost_reason_note"),
    /** The order this request produced. The explicit Request→Order relation of §26. */
    orderId: text("order_id").references(() => orders.id),

    // KPI timestamps (§23). received_at is when the client actually approached
    // us; created_at is when someone typed it in. The gap between them is the
    // registration-time metric, so they must stay separate fields.
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    workStartedAt: timestamp("work_started_at", { withTimezone: true }),
    quotationStartedAt: timestamp("quotation_started_at", { withTimezone: true }),
    quotationSentAt: timestamp("quotation_sent_at", { withTimezone: true }),
    /** Won, Lost or Cancelled — the status says which. */
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    orderCreatedAt: timestamp("order_created_at", { withTimezone: true }),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [
    index("requests_account_id_idx").on(t.accountId),
    index("requests_status_idx").on(t.status),
    index("requests_responsible_idx").on(t.responsibleUserId),
    index("requests_received_at_idx").on(t.receivedAt),
  ],
);

/**
 * The commercial offer for a request — ONE stage, not two (§13, Appendix D).
 *
 * Internal cost rates and the client-facing selling price are two blocks of the
 * same record, never two workflow steps: the desk speaks of "the quotation",
 * and the UI must not reintroduce a separate "pricing" phase. The detailed
 * line-item structure is the future Finance module's; what matters now is that
 * the entity exists and is tied to the request.
 *
 * Rows are versioned rather than overwritten — a re-quote after the client
 * pushes back is new commercial history, and `quotation_sent_at` on the request
 * must keep pointing at the first offer for the time-to-quote KPI.
 */
export const quotations = pgTable(
  "quotations",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    /** 1-based; the highest version is the current offer. */
    version: integer("version").notNull().default(1),
    currency: text("currency").notNull().default("USD"),
    /** What we expect to pay — carrier rates and expected extras, rolled up. */
    expectedCostTotal: numeric("expected_cost_total", { precision: 12, scale: 2 }),
    /** What the client is offered. */
    sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }),
    validUntil: date("valid_until"),
    transitTimeDays: integer("transit_time_days"),
    terms: text("terms"),
    notes: text("notes"),
    /** Set when the offer actually goes out; null while it is being prepared. */
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [
    index("quotations_request_id_idx").on(t.requestId),
    uniqueIndex("quotations_request_version_idx").on(t.requestId, t.version),
  ],
);

/**
 * One movement within a shipment. A single-mode shipment has exactly one leg; a
 * multimodal one has several, ordered by `legNumber` (§8.5). Storing even the
 * simple case as a leg keeps one storage model and one form component.
 *
 * The columns are the union of Appendix A's equipment fields; which ones apply
 * is decided by `legFields()` in src/lib/transport-matrix.ts, not by nullability.
 * Cargo (packages, weight, volume, dimensions) is deliberately absent — it is
 * the same cargo whichever leg carries it, so it lives in `cargo_details`.
 */
export const transportLegs = pgTable(
  "transport_legs",
  {
    id: id(),
    parentType: shipmentParentEnum("parent_type").notNull(),
    parentId: text("parent_id").notNull(),
    /** 1-based position in the route. Contiguous; the app renumbers on reorder. */
    legNumber: integer("leg_number").notNull(),
    /** Never "multimodal" — that is a property of the shipment, not of a leg. */
    transportType: transportFamilyEnum("transport_type").notNull(),
    subtype: transportSubtypeEnum("subtype"),

    originCountry: text("origin_country"),
    originCity: text("origin_city"),
    /**
     * Port of loading, station or airport, depending on `transportType`. One
     * column rather than six near-identical ones; `legFields().pointKind` says
     * what to call it. Road legs leave it null.
     */
    originPoint: text("origin_point"),
    destinationCountry: text("destination_country"),
    destinationCity: text("destination_city"),
    destinationPoint: text("destination_point"),

    vehicleType: vehicleTypeEnum("vehicle_type"),
    vehicleCount: integer("vehicle_count"),
    containerType: containerTypeEnum("container_type"),
    containerCount: integer("container_count"),
    wagonType: wagonTypeEnum("wagon_type"),
    wagonCount: integer("wagon_count"),
    /** Ro-Ro: the rolling unit being shipped, described in the client's words. */
    equipmentDescription: text("equipment_description"),
    equipmentCount: integer("equipment_count"),

    // Air only. chargeableWeightKg is derived from the cargo by default and
    // then editable, because the carrier's figure wins over ours.
    chargeableWeightKg: numeric("chargeable_weight_kg", { precision: 12, scale: 2 }),
    volumetricDivisor: integer("volumetric_divisor"),
    routingPreference: routingPreferenceEnum("routing_preference"),

    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("transport_legs_parent_idx").on(t.parentType, t.parentId)],
);

/**
 * The cargo, once per shipment (§9). Conditional blocks — dangerous goods,
 * temperature control, oversized — are stored as a flag plus its detail
 * columns; the flag is what the form branches on and what validation keys off.
 */
export const cargoDetails = pgTable(
  "cargo_details",
  {
    id: id(),
    parentType: shipmentParentEnum("parent_type").notNull(),
    parentId: text("parent_id").notNull(),

    description: text("description"),
    hsCodes: jsonb("hs_codes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    packages: integer("packages"),
    grossWeightKg: numeric("gross_weight_kg", { precision: 12, scale: 2 }),
    volumeM3: numeric("volume_m3", { precision: 12, scale: 2 }),
    /** Centimetres per side, with a piece count. Several rows are the norm (§9). */
    dimensions: jsonb("dimensions")
      .$type<{ lengthCm: number; widthCm: number; heightCm: number; quantity: number }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    cargoValue: numeric("cargo_value", { precision: 14, scale: 2 }),
    cargoCurrency: text("cargo_currency"),
    stackable: stackableEnum("stackable"),

    dangerousGoods: boolean("dangerous_goods").notNull().default(false),
    /** ADR / IMO class, e.g. "3" or "6.1". */
    dgClass: text("dg_class"),
    unNumber: text("un_number"),
    dgNotes: text("dg_notes"),

    temperatureControlled: boolean("temperature_controlled").notNull().default(false),
    tempMinC: numeric("temp_min_c", { precision: 6, scale: 2 }),
    tempMaxC: numeric("temp_max_c", { precision: 6, scale: 2 }),

    oversized: boolean("oversized").notNull().default(false),
    oversizedNotes: text("oversized_notes"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // One cargo block per shipment — the unique index is what makes "one row" true
  // rather than merely intended.
  (t) => [uniqueIndex("cargo_details_parent_idx").on(t.parentType, t.parentId)],
);

// --- Communication (specification §17, §18) ------------------------------
//
// These tables exist so the Outlook integration can land without touching the
// Request/Order core: a mail sync writes rows here and links them, and nothing
// in the request-creation path depends on any of it (§17.11 — integration
// failure must never block manual entry).
//
// The same tables carry manually-logged WhatsApp and phone notes, because §18
// is explicit that the channel is a property of the message, not a separate
// business process.

export const messageDirectionEnum = pgEnum("message_direction", ["incoming", "outgoing"]);
export const messageChannelEnum = pgEnum("message_channel", [
  "email",
  "whatsapp",
  "phone",
  "other",
]);

/** An email thread, keyed by the provider's conversation identifier (§17.3). */
export const emailConversations = pgTable(
  "email_conversations",
  {
    id: id(),
    /** Microsoft Graph `conversationId` — the thread's identity upstream. */
    externalId: text("external_id").notNull().unique(),
    subject: text("subject"),
    /** The mailbox this thread was synced from; sync is per CRM user (§17.11). */
    mailboxUserId: text("mailbox_user_id").references(() => user.id),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("email_conversations_mailbox_idx").on(t.mailboxUserId)],
);

/**
 * One message. Provider identifiers are kept separate from our own id (§17.11),
 * and `internetMessageId`/`inReplyTo` are stored alongside the Graph id so a
 * thread can still be reassembled if the provider's own threading is wrong.
 */
export const emailMessages = pgTable(
  "email_messages",
  {
    id: id(),
    conversationId: text("conversation_id").references(() => emailConversations.id, {
      onDelete: "cascade",
    }),
    channel: messageChannelEnum("channel").notNull().default("email"),
    direction: messageDirectionEnum("direction").notNull(),
    /** Null for a manually logged call or WhatsApp note — there is no upstream id. */
    externalId: text("external_id").unique(),
    internetMessageId: text("internet_message_id"),
    inReplyTo: text("in_reply_to"),
    referencesHeader: text("references_header"),
    subject: text("subject"),
    fromName: text("from_name"),
    fromEmail: text("from_email"),
    toJson: jsonb("to_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ccJson: jsonb("cc_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    bodyText: text("body_text"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: createdAt(),
    createdBy: createdBy(),
  },
  (t) => [
    index("email_messages_conversation_idx").on(t.conversationId),
    index("email_messages_from_email_idx").on(t.fromEmail),
  ],
);

/**
 * Message ↔ request, many-to-many in both directions on purpose: one email can
 * contain several shipments and spawn several requests (§17.8), and one request
 * accumulates threads as the client sends packing lists separately (§17.9).
 */
export const requestEmails = pgTable(
  "request_emails",
  {
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    linkedAt: createdAt(),
    linkedBy: createdBy(),
  },
  (t) => [
    primaryKey({ columns: [t.requestId, t.messageId] }),
    index("request_emails_message_idx").on(t.messageId),
  ],
);

/**
 * An attachment as it arrived. Every attachment is listed, but only the ones a
 * user promotes become business documents — `documentId` is what "Save to
 * Documents" sets (§17.10).
 */
export const emailAttachments = pgTable(
  "email_attachments",
  {
    id: id(),
    messageId: text("message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    /** Where the bytes live once fetched; null while only the metadata is known. */
    s3Key: text("s3_key"),
    documentId: text("document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("email_attachments_message_idx").on(t.messageId)],
);

// --- Tasks (specification §19) -------------------------------------------

export const taskTypeEnum = pgEnum("task_type", TASK_TYPES);
/**
 * A task hangs off whichever record the work belongs to. Same polymorphic
 * pattern as `documents` — no DB-level FK, application-level cascade.
 */
export const taskParentEnum = pgEnum("task_parent", ["request", "order"]);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    parentType: taskParentEnum("parent_type").notNull(),
    parentId: text("parent_id").notNull(),
    type: taskTypeEnum("type").notNull().default("other"),
    title: text("title").notNull(),
    notes: text("notes"),
    /** Who owes the work. Null while nobody has picked it up. */
    assigneeUserId: text("assignee_user_id").references(() => user.id),
    /** A date, not a timestamp: the desk works in days, not appointments. */
    dueDate: date("due_date"),
    /** Set when the task is ticked off; null means still open. */
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [
    index("tasks_parent_idx").on(t.parentType, t.parentId),
    // The open-work views ("what is due", "what is mine") both filter on these.
    index("tasks_due_idx").on(t.dueDate),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("notifications_status_idx").on(t.status)],
);
