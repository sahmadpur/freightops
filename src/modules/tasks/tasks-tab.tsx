"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Field, inputCls } from "@/components/ui/form";
import { TASK_TYPES } from "@/lib/task-types";
import { createTask, deleteTask, setTaskDone } from "./actions";
import type { TaskRow } from "./queries";
import type { ActionResult } from "./schema";

const blank = { type: "other", title: "", notes: "", assigneeUserId: "", dueDate: "" };

/**
 * The §19 Tasks tab. One list, open work first, and an add row that asks for a
 * title and nothing else — type, owner and date are there when they matter and
 * out of the way when they do not.
 */
export function TasksTab({
  parentType,
  parentId,
  tasks,
  assigneeOpts,
}: {
  parentType: "request" | "order";
  parentId: string;
  tasks: TaskRow[];
  assigneeOpts: ComboOption[];
}) {
  const t = useTranslations("tasks");
  const tt = useTranslations("taskType");
  const tf = useTranslations("fields");
  const ta = useTranslations("actions");
  const router = useRouter();

  const [v, setV] = useState(blank);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const set = (patch: Partial<typeof v>) => setV((s) => ({ ...s, ...patch }));

  const today = new Date().toISOString().slice(0, 10);

  async function add() {
    if (!v.title.trim()) return;
    setPending(true);
    const r = await createTask(parentType, parentId, v);
    setPending(false);
    setResult(r);
    if (r.ok) {
      setV(blank);
      router.refresh();
    }
  }

  async function run(action: Promise<ActionResult>) {
    await action;
    router.refresh();
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <div className="space-y-6">
      {tasks.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-edge-soft border-y border-edge-soft">
          {tasks.map((task) => {
            const done = task.doneAt !== null;
            // Only an open task can be late; a finished one is history.
            const overdue = !done && task.dueDate !== null && task.dueDate < today;
            return (
              <li key={task.id} className="flex items-start gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={done}
                  aria-label={t("markDone")}
                  className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--brand))]"
                  onChange={(e) => run(setTaskDone(task.id, e.target.checked))}
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] ${done ? "text-ink-soft line-through" : "text-ink"}`}>
                    {task.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-soft">
                    <span>{tt(task.type)}</span>
                    {task.assigneeName && <span>· {task.assigneeName}</span>}
                    {task.dueDate && (
                      <span className={overdue ? "font-medium text-[rgb(var(--danger-fg))]" : undefined}>
                        · {t("due")} {task.dueDate}
                      </span>
                    )}
                  </div>
                  {task.notes && <p className="mt-1 text-[11.5px] text-ink-soft">{task.notes}</p>}
                </div>
                <button
                  type="button"
                  className="px-2 text-ink-soft hover:text-[rgb(var(--danger-fg))]"
                  aria-label={tf("remove")}
                  onClick={() => run(deleteTask(task.id))}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("newTask")} htmlFor="taskTitle" error={fe.title} className="sm:col-span-2">
          <input
            id="taskTitle"
            className={inputCls}
            value={v.title}
            placeholder={t("titlePlaceholder")}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </Field>
        <Field label={t("type")} htmlFor="taskType" error={fe.type}>
          <select
            id="taskType"
            className={inputCls}
            value={v.type}
            onChange={(e) => set({ type: e.target.value })}
          >
            {TASK_TYPES.map((k) => (
              <option key={k} value={k}>
                {tt(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("dueDate")} htmlFor="taskDue" error={fe.dueDate}>
          <input
            id="taskDue"
            type="date"
            className={inputCls}
            value={v.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
          />
        </Field>
        <Field label={t("assignee")} htmlFor="taskAssignee" error={fe.assigneeUserId} className="sm:col-span-2">
          <Combobox
            id="taskAssignee"
            value={v.assigneeUserId}
            onChange={(value) => set({ assigneeUserId: value })}
            options={assigneeOpts}
            placeholder={t("unassigned")}
          />
        </Field>
        <Field label={t("notes")} htmlFor="taskNotes" error={fe.notes} className="sm:col-span-2">
          <input
            id="taskNotes"
            className={inputCls}
            value={v.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
      </div>

      <button type="button" onClick={add} disabled={pending || !v.title.trim()} className="btn-primary">
        {pending ? ta("saving") : t("addTask")}
      </button>
    </div>
  );
}
