import postgres from "postgres";

const expected = [
  "user", "session", "account", "verification",
  "accounts", "carriers", "contacts", "transport_modes", "orders",
  "payments", "documents", "comments", "audit_log", "invitations",
  "order_counters", "notifications",
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
  "notification_status",
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

await sql.end();
console.log("OK — schema verified: 16 tables, 11 enums, user→accounts FK");
