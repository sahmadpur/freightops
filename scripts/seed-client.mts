import { createUserWithPassword } from "../src/lib/create-user";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { eq } from "drizzle-orm";

const email = process.env.SEED_CLIENT_EMAIL ?? "client@verifyco.test";
const password = process.env.SEED_CLIENT_PASSWORD ?? "client12345";
const name = process.env.SEED_CLIENT_NAME ?? "Verify Client";
// Account the client belongs to — required (no public sign-up / account guessing).
const accountId = process.env.SEED_CLIENT_ACCOUNT_ID;
if (!accountId) {
  console.error("Set SEED_CLIENT_ACCOUNT_ID to the client's account id");
  process.exit(1);
}

const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
if (existing) {
  console.log(`Client ${email} already exists — skipping`);
  process.exit(0);
}

await createUserWithPassword({ email, password, name, role: "client", accountId });
console.log(`Seeded client ${email} (password: ${password}) on account ${accountId}`);
process.exit(0);
