import { createUserWithPassword } from "../src/lib/create-user";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { eq } from "drizzle-orm";

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@freightops.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
const name = process.env.SEED_ADMIN_NAME ?? "Admin";

const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
if (existing) {
  console.log(`Admin ${email} already exists — skipping`);
  process.exit(0);
}

await createUserWithPassword({ email, password, name, role: "admin" });
console.log(`Seeded admin ${email} (password: ${password}) — change it after first sign-in`);
process.exit(0);
