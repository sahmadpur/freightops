"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { UserRow } from "./queries";
import { setUserActive, setUserRole } from "./actions";

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changeRole(id: string, role: string) {
    setBusyId(id);
    try {
      const r = await setUserRole(id, { role });
      if (r.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }
  async function toggleActive(id: string, active: boolean) {
    setBusyId(id);
    try {
      const r = await setUserActive(id, active);
      if (r.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  // Columns are rebuilt each render, so render closures always see the latest busyId.
  const columns: Column<UserRow>[] = [
    { key: "name", header: t("name"), render: (u) => u.name },
    { key: "email", header: t("email"), hiddenOnMobile: true, render: (u) => <span className="text-ink-soft">{u.email}</span> },
    {
      key: "role",
      header: t("role"),
      width: "160px",
      render: (u) => (
        <select
          value={u.role}
          disabled={u.id === currentUserId || busyId === u.id}
          onChange={(e) => changeRole(u.id, e.target.value)}
          className={`${inputCls} w-auto`}
        >
          <option value="admin">{t("roleAdmin")}</option>
          <option value="operator">{t("roleOperator")}</option>
          <option value="client">{t("roleClient")}</option>
        </select>
      ),
    },
    { key: "account", header: t("account"), hiddenOnMobile: true, render: (u) => <span className="text-ink-soft">{u.accountTitle ?? "—"}</span> },
    {
      key: "status",
      header: t("status"),
      width: "110px",
      render: (u) => (
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] ${
            u.active
              ? "bg-[rgb(var(--approval-approved-bg))] text-[rgb(var(--approval-approved-fg))]"
              : "bg-surface-chip-active text-ink-soft"
          }`}
        >
          {u.active ? t("active") : t("inactive")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "110px",
      align: "right",
      render: (u) => (
        <button
          type="button"
          disabled={u.id === currentUserId || busyId === u.id}
          onClick={() => toggleActive(u.id, !u.active)}
          className="text-xs text-brand hover:underline disabled:opacity-40"
        >
          {u.active ? t("deactivate") : t("activate")}
        </button>
      ),
    },
  ];

  return (
    <DataTable columns={columns} rows={users} rowKey={(u) => u.id} storageKey="admin-users" minWidth={760} empty={t("noUsers")} />
  );
}
