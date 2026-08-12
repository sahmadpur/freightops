import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One connection pool per process, kept on `globalThis`.
 *
 * Next's dev server re-evaluates this module on every hot reload. Without the
 * cache each reload opened another pool (postgres.js defaults to 10 sockets and
 * never closes idle ones), so an afternoon's editing exhausted Postgres'
 * connection slots and every page started failing with "too many clients".
 */
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

const client = globalForDb.pgClient ?? postgres(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
