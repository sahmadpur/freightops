import postgres from "postgres";

const expected = [
  "user", "session", "account", "verification",
  "accounts", "carriers", "contacts", "transport_modes", "orders",
  "payments", "documents", "comments", "audit_log", "invitations",
];

const sql = postgres(process.env.DATABASE_URL!);
const rows = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public'
`;
const names = new Set(rows.map((r) => r.table_name as string));
const missing = expected.filter((t) => !names.has(t));
await sql.end();
if (missing.length > 0) {
  console.error("MISSING TABLES:", missing.join(", "));
  process.exit(1);
}
console.log(`OK — all ${expected.length} tables present`);
