import postgres from "postgres";

const expected = [
  "user", "session", "account", "verification",
  "accounts", "contacts", "orders",
  "payments", "order_finance_lines", "documents", "comments", "audit_log", "invitations",
  "monthly_counters", "annual_counters", "doc_counters", "notifications",
  "fx_rates", "customs_clearances", "customs_clearance_items",
  // The CRM layer: requests, their shipment payload and commercial offer.
  "requests", "transport_legs", "cargo_details", "quotations",
  // Communication seams — written by the future Outlook sync, and by manually
  // logged calls today.
  "email_conversations", "email_messages", "request_emails", "email_attachments",
];

const sql = postgres(process.env.DATABASE_URL!);

// Table check
const rows = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public'
`;
const names = new Set(rows.map((r) => r.table_name as string));
const missing = expected.filter((t) => !names.has(t));
if (missing.length > 0) {
  console.error("MISSING TABLES:", missing.join(", "));
  await sql.end();
  process.exit(1);
}

// Enum check
const expectedEnums = [
  "user_role", "language", "order_status", "incoterms", "delivery_format",
  "mode_type", "payment_direction", "doc_type", "contact_parent", "document_parent",
  "notification_status", "finance_line_side", "finance_category", "customs_item_category",
  "doc_counter_kind", "preferred_channel",
  "request_status", "lost_reason", "lead_source", "shipment_parent",
  "transport_family", "transport_subtype", "vehicle_type", "container_type", "wagon_type",
  "routing_preference", "stackable", "message_direction", "message_channel",
];
const enumRows = await sql`
  select typname from pg_type where typtype = 'e'
`;
const enumNames = new Set(enumRows.map((r) => r.typname as string));
const missingEnums = expectedEnums.filter((e) => !enumNames.has(e));
if (missingEnums.length > 0) {
  console.error("MISSING ENUMS:", missingEnums.join(", "));
  await sql.end();
  process.exit(1);
}

// FK check
const fkRows = await sql`
  select conname from pg_constraint where conname = 'user_account_id_accounts_id_fk'
`;
if (fkRows.length === 0) {
  console.error("MISSING FK: user_account_id_accounts_id_fk not found");
  await sql.end();
  process.exit(1);
}

// Columns the 1–18 reshape added or removed; catches a half-applied migration.
const orderCols = await sql`
  select column_name from information_schema.columns where table_name = 'orders'
`;
const colNames = new Set(orderCols.map((r) => r.column_name as string));
const mustHave = [
  "transport_type", "from_country", "to_country", "cargo_items", "currency", "rollback_number",
  "from_city", "to_city", "delivered_at", "closed_at",
];
const mustNotHave = ["route", "client_order_id", "cargo_description", "transport_mode_id"];
const badCols = [
  ...mustHave.filter((c) => !colNames.has(c)).map((c) => `missing ${c}`),
  ...mustNotHave.filter((c) => colNames.has(c)).map((c) => `leftover ${c}`),
];
if (badCols.length > 0) {
  console.error("ORDERS COLUMNS:", badCols.join(", "));
  await sql.end();
  process.exit(1);
}

// The order lifecycle was reduced to six stages; a half-applied 0016 would
// leave retired values behind and every status filter would silently miss rows.
const statusValues = await sql`select unnest(enum_range(null::order_status))::text as v`;
const statuses = statusValues.map((r) => r.v as string);
const expectedStatuses = ["created", "operations", "booked", "in_transit", "delivered", "closed"];
if (statuses.join(",") !== expectedStatuses.join(",")) {
  console.error("ORDER STATUS ENUM:", statuses.join(", "));
  await sql.end();
  process.exit(1);
}

await sql.end();
console.log(
  `OK — schema verified: ${expected.length} tables, ${expectedEnums.length} enums, orders columns, user→accounts FK`,
);
