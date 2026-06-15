"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
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

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2">{t("name")}</th>
            <th className="px-4 py-2">{t("email")}</th>
            <th className="px-4 py-2">{t("role")}</th>
            <th className="px-4 py-2">{t("account")}</th>
            <th className="px-4 py-2">{t("status")}</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">
                  <select
                    value={u.role}
                    disabled={isSelf || busyId === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className={`${inputCls} w-auto`}
                  >
                    <option value="admin">{t("roleAdmin")}</option>
                    <option value="operator">{t("roleOperator")}</option>
                    <option value="client">{t("roleClient")}</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-slate-500">{u.accountTitle ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] ${u.active ? "bg-[#d4f2e7] text-[#085041]" : "bg-slate-200 text-slate-600"}`}>
                    {u.active ? t("active") : t("inactive")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    disabled={isSelf || busyId === u.id}
                    onClick={() => toggleActive(u.id, !u.active)}
                    className="text-xs text-indigo-600 hover:underline disabled:opacity-40"
                  >
                    {u.active ? t("deactivate") : t("activate")}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
