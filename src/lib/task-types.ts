/**
 * What a task on a request or an order actually is (§19 Tasks tab). The type is
 * how the desk scans a list — "three calls and a document chase" reads faster
 * than three identical rows — and what a future reminder rule would key off.
 *
 * Kept free of db imports so client components can bundle it. Must stay in sync
 * with the `task_type` pgEnum. Labels live in the `taskType` i18n namespace.
 */
export const TASK_TYPES = [
  "call",
  "email",
  "meeting",
  "document",
  "quotation",
  "booking",
  "follow_up",
  "other",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];
