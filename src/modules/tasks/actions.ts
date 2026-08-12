"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, requests, tasks } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { taskInputSchema, taskParentSchema, type ActionResult, type TaskParent } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The parent must exist before a task can hang off it — nothing else is checked. */
async function parentExists(tx: Tx, parentType: TaskParent, parentId: string): Promise<boolean> {
  if (parentType === "request") {
    return Boolean(await tx.query.requests.findFirst({ where: eq(requests.id, parentId) }));
  }
  return Boolean(await tx.query.orders.findFirst({ where: eq(orders.id, parentId) }));
}

export async function createTask(
  parentType: string,
  parentId: string,
  input: unknown,
): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parent = taskParentSchema.safeParse(parentType);
  if (!parent.success) return { ok: false, error: "invalid_parent" };
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const result = await db.transaction(async (tx) => {
    if (!(await parentExists(tx, parent.data, parentId))) return "not_found" as const;
    const [row] = await tx
      .insert(tasks)
      .values({
        parentType: parent.data,
        parentId,
        type: d.type,
        title: d.title,
        notes: d.notes || null,
        assigneeUserId: d.assigneeUserId || null,
        dueDate: d.dueDate || null,
        createdBy: session.user.id,
      })
      .returning({ id: tasks.id });

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: parent.data,
      entityId: parentId,
      action: "task_created",
      changes: [{ field: "title", oldValue: null, newValue: d.title }],
    });
    return row.id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

/** Tick a task off, or put it back. The audit entry says which way it went. */
export async function setTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const before = await tx.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!before) return "not_found" as const;
    await tx
      .update(tasks)
      .set({ doneAt: done ? new Date() : null })
      .where(eq(tasks.id, taskId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: before.parentType,
      entityId: before.parentId,
      action: done ? "task_completed" : "task_reopened",
      changes: [{ field: "title", oldValue: null, newValue: before.title }],
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: taskId };
}

export async function updateTask(taskId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!before) return "not_found" as const;
    await tx
      .update(tasks)
      .set({
        type: d.type,
        title: d.title,
        notes: d.notes || null,
        assigneeUserId: d.assigneeUserId || null,
        dueDate: d.dueDate || null,
      })
      .where(eq(tasks.id, taskId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: before.parentType,
      entityId: before.parentId,
      action: "task_updated",
      changes: [{ field: "title", oldValue: before.title, newValue: d.title }],
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: taskId };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const result = await db.transaction(async (tx) => {
    const before = await tx.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!before) return "not_found" as const;
    await tx.delete(tasks).where(eq(tasks.id, taskId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: before.parentType,
      entityId: before.parentId,
      action: "task_removed",
      changes: [{ field: "title", oldValue: before.title, newValue: null }],
    });
    return "ok" as const;
  });
  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: taskId };
}
