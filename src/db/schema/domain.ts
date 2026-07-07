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
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userRoleEnum } from "./enums";
import { user } from "./auth";

export const orderStatusEnum = pgEnum("order_status", [
  "created",
  "received",
  "internal_transit",
  "loaded",
  "transit",
  "at_border",
  "at_customs",
  "arrived",
  "delivered",
  "closed",
]);
export const incotermsEnum = pgEnum("incoterms", [
  "EXW",
  "FCA",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
]);
export const deliveryFormatEnum = pgEnum("delivery_format", ["FCL", "LCL", "FTL", "LTL"]);
export const modeTypeEnum = pgEnum("mode_type", [
  "truck",
  "container",
  "air",
  "postal",
  "rail",
  "sea",
]);
export const paymentDirectionEnum = pgEnum("payment_direction", ["incoming", "outgoing"]);
export const financeLineSideEnum = pgEnum("finance_line_side", ["revenue", "cost"]);
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
export const contactParentEnum = pgEnum("contact_parent", ["account", "carrier"]);
export const documentParentEnum = pgEnum("document_parent", ["order", "transport_mode"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);

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
  taxId: text("tax_id"),
  address: text("address"),
  notes: text("notes"),
  // Soft delete: archived rows are hidden from lists but retained (recoverable).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
});

export const carriers = pgTable("carriers", {
  id: id(),
  title: text("title").notNull(),
  address: text("address"),
  notes: text("notes"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
});

// Polymorphic parent — no DB-level FK; application code must delete children when deleting the parent.
export const contacts = pgTable("contacts", {
  id: id(),
  parentType: contactParentEnum("parent_type").notNull(),
  parentId: text("parent_id").notNull(),
  name: text("name").notNull(),
  phones: jsonb("phones").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  emails: jsonb("emails").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const transportModes = pgTable("transport_modes", {
  id: id(),
  modeType: modeTypeEnum("mode_type").notNull(),
  number: text("number").notNull(),
  fromCountry: text("from_country"),
  toCountry: text("to_country"),
  route: text("route"),
  loadingDate: date("loading_date"),
  plannedArrivalDate: date("planned_arrival_date"),
  totalWeightKg: numeric("total_weight_kg", { precision: 12, scale: 2 }),
  totalVolumeM3: numeric("total_volume_m3", { precision: 12, scale: 2 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
});

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: text("number").notNull().unique(),
    title: text("title").notNull(),
    clientOrderId: text("client_order_id"),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    carrierId: text("carrier_id").references(() => carriers.id),
    transportModeId: text("transport_mode_id").references(() => transportModes.id),
    route: text("route"),
    cargoDescription: text("cargo_description"),
    packages: integer("packages"),
    weightKg: numeric("weight_kg", { precision: 12, scale: 2 }),
    volumeM3: numeric("volume_m3", { precision: 12, scale: 2 }),
    incoterms: incotermsEnum("incoterms"),
    deliveryFormat: deliveryFormatEnum("delivery_format"),
    status: orderStatusEnum("status").notNull().default("created"),
    // v1 is single-currency (USD) per BRD; revisit if multi-currency lands.
    // Rollups of order_finance_lines (recomputed on any line change):
    // clientCharge = Σ revenue lines, carrierCost = Σ cost lines. Both in USD.
    clientCharge: numeric("client_charge", { precision: 12, scale: 2 }),
    carrierCost: numeric("carrier_cost", { precision: 12, scale: 2 }),
    // FX rate: AZN per 1 USD (amounts are stored in USD; AZN is shown as computed).
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

// Itemized revenue / carrier-cost lines for an order. Their sums are cached on
// orders.clientCharge (revenue) and orders.carrierCost (cost). All amounts USD.
export const orderFinanceLines = pgTable(
  "order_finance_lines",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    side: financeLineSideEnum("side").notNull(),
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

export const orderCounters = pgTable("order_counters", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
});

export const docCounterKindEnum = pgEnum("doc_counter_kind", ["invoice", "act"]);

// Per-year sequences for generated documents (invoice / ACT numbers), same
// row-lock upsert pattern as orderCounters. See src/lib/doc-number.ts.
export const docCounters = pgTable(
  "doc_counters",
  {
    kind: docCounterKindEnum("kind").notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kind, t.year] })],
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
