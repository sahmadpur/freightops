import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks, user } from "@/db/schema";
import type { TaskParent } from "./schema";

export type TaskRow = {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  doneAt: Date | null;
};

/**
 * The tasks on one record (§19). Open ones first, then by due date — a task
 * with no date sorts last within its group, because a dated task is the one
 * that can be late.
 */
export async function listTasks(parentType: TaskParent, parentId: string): Promise<TaskRow[]> {
  return db
    .select({
      id: tasks.id,
      type: tasks.type,
      title: tasks.title,
      notes: tasks.notes,
      assigneeUserId: tasks.assigneeUserId,
      assigneeName: user.name,
      dueDate: tasks.dueDate,
      doneAt: tasks.doneAt,
    })
    .from(tasks)
    .leftJoin(user, eq(user.id, tasks.assigneeUserId))
    .where(and(eq(tasks.parentType, parentType), eq(tasks.parentId, parentId)))
    .orderBy(
      sql`${tasks.doneAt} is not null`,
      sql`${tasks.dueDate} asc nulls last`,
      asc(tasks.createdAt),
    );
}

/** Staff who can own a task — the same set that can be a responsible manager. */
export async function taskAssigneeOptions() {
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.active, true), inArray(user.role, ["admin", "operator", "supervisor"])))
    .orderBy(asc(user.name));
  return rows.map((u) => ({ value: u.id, label: u.name }));
}
