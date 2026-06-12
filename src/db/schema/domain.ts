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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
export const modeTypeEnum = pgEnum("mode_type", ["vehicle", "air", "postal", "rail", "sea"]);
export const paymentDirectionEnum = pgEnum("payment_direction", ["incoming", "outgoing"]);
export const docTypeEnum = pgEnum("doc_type", [
  "cmr",
  "awb",
  "bill_of_lading",
  "invoice",
  "packing_list",
  "certificate",
  "waybill",
  "cargo_photos",
  "other",
]);
export const contactParentEnum = pgEnum("contact_parent", ["account", "carrier"]);
export const documentParentEnum = pgEnum("document_parent", ["order", "transport_mode"]);

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
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
});

export const carriers = pgTable("carriers", {
  id: id(),
  title: text("title").notNull(),
  address: text("address"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
});

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

export const orders = pgTable("orders", {
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
  clientCharge: numeric("client_charge", { precision: 12, scale: 2 }),
  carrierCost: numeric("carrier_cost", { precision: 12, scale: 2 }),
  additionalCosts: numeric("additional_costs", { precision: 12, scale: 2 }),
  additionalCostsNote: text("additional_costs_note"),
  expectedProfit: numeric("expected_profit", { precision: 12, scale: 2 }),
  invoiceNumber: text("invoice_number"),
  invoiceDate: date("invoice_date"),
  amountReceivable: numeric("amount_receivable", { precision: 12, scale: 2 }),
  amountPayable: numeric("amount_payable", { precision: 12, scale: 2 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  direction: paymentDirectionEnum("direction").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
  createdAt: createdAt(),
  createdBy: createdBy(),
});

export const documents = pgTable("documents", {
  id: id(),
  parentType: documentParentEnum("parent_type").notNull(),
  parentId: text("parent_id").notNull(),
  fileName: text("file_name").notNull(),
  docType: docTypeEnum("doc_type").notNull().default("other"),
  sizeBytes: integer("size_bytes"),
  s3Key: text("s3_key").notNull(),
  visibleToClient: boolean("visible_to_client").notNull().default(false),
  createdAt: createdAt(),
  createdBy: createdBy(),
});

export const comments = pgTable("comments", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  userId: text("user_id").references(() => user.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: createdAt(),
});

export const invitations = pgTable("invitations", {
  id: id(),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'admin' | 'operator' | 'client'
  accountId: text("account_id").references(() => accounts.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  invitedBy: text("invited_by").references(() => user.id),
  createdAt: createdAt(),
});
