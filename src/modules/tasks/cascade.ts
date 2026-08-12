import { and, eq } from "drizzle-orm";
import type { db } from "@/db";
import { tasks } from "@/db/schema";
import type { TaskParent } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Delete every task on a record. The parent is polymorphic, so there is no
 * DB-level cascade — same contract as `deleteShipment`.
 */
export async function deleteTasksFor(tx: Tx, parentType: TaskParent, parentId: string) {
  await tx.delete(tasks).where(and(eq(tasks.parentType, parentType), eq(tasks.parentId, parentId)));
}
