import { z } from "zod";
import { TASK_TYPES } from "@/lib/task-types";
import { dateString, optText } from "@/lib/validation";
export type { ActionResult } from "@/lib/forms";

/**
 * A task on a request or an order (§19). Only the title is required — a task
 * jotted down mid-call is still a task, and forcing a type, an owner and a date
 * on it is how a task list stops being used.
 */
export const taskInputSchema = z.object({
  type: z.enum(TASK_TYPES).default("other"),
  title: z.string().trim().min(1).max(300),
  notes: optText(2000),
  assigneeUserId: optText(100),
  dueDate: dateString,
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskParentSchema = z.enum(["request", "order"]);
export type TaskParent = z.infer<typeof taskParentSchema>;
