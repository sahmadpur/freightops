"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { createCargoType, renameCargoType, setCargoTypeArchived } from "./actions";
import type { CargoTypeRow } from "./queries";

/** Inline CRUD over the cargo-description dictionary (справочник). */
export function CargoTypesTable({ rows }: { rows: CargoTypeRow[] }) {
  const t = useTranslations("admin");
  const ta = useTranslations("actions");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  async function add() {
    const value = title.trim();
    if (!value || pending) return;
    setPending(true);
    const r = await createCargoType({ title: value });
    setPending(false);
    if (!r.ok) {
      setError(r.error === "exists" ? t("cargoTypeExists") : (r.fieldErrors?.title?.[0] ?? r.error ?? "error"));
      return;
    }
    setTitle("");
    setError(null);
    router.refresh();
  }

  async function rename(id: string) {
    const value = editTitle.trim();
    if (!value) return;
    const r = await renameCargoType(id, { title: value });
    if (r.ok) {
      setEditId(null);
      router.refresh();
    }
  }

  async function setArchived(id: string, archived: boolean) {
    await setCargoTypeArchived(id, archived);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className={inputCls}
          placeholder={t("newCargoType")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} disabled={pending} className="btn-secondary shrink-0">
          + {ta("new")}
        </button>
      </div>
      {error && <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">{error}</p>}

      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-edge-soft">
              <td className={`py-1.5 ${row.archived ? "text-ink-soft line-through" : "text-ink"}`}>
                {editId === row.id ? (
                  <input
                    className={inputCls}
                    value={editTitle}
                    autoFocus
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rename(row.id);
                      }
                      if (e.key === "Escape") setEditId(null);
                    }}
                  />
                ) : (
                  row.title
                )}
              </td>
              <td className="py-1.5 text-right">
                <span className="flex items-center justify-end gap-3 text-xs">
                  {editId === row.id ? (
                    <>
                      <button type="button" className="text-brand hover:underline" onClick={() => rename(row.id)}>
                        {ta("save")}
                      </button>
                      <button type="button" className="text-ink-soft hover:underline" onClick={() => setEditId(null)}>
                        {ta("cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      {!row.archived && (
                        <button
                          type="button"
                          className="text-brand hover:underline"
                          onClick={() => {
                            setEditId(row.id);
                            setEditTitle(row.title);
                          }}
                        >
                          {ta("edit")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-ink-soft hover:underline"
                        onClick={() => setArchived(row.id, !row.archived)}
                      >
                        {row.archived ? t("restoreCargoType") : t("archiveCargoType")}
                      </button>
                    </>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
