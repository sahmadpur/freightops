import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotations } from "@/db/schema";

export type QuotationRow = typeof quotations.$inferSelect;

/** Every version, newest first. The first entry is the current offer. */
export async function listQuotations(requestId: string): Promise<QuotationRow[]> {
  return db
    .select()
    .from(quotations)
    .where(eq(quotations.requestId, requestId))
    .orderBy(desc(quotations.version));
}
