"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { inviteUser } from "./actions";

export function InviteUserForm({ accounts }: { accounts: { id: string; title: string }[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await inviteUser({ email, role, accountId: role === "client" ? accountId : undefined });
      if (r.ok) {
        setEmail("");
        setAccountId("");
        setMsg(t("inviteSent"));
        router.refresh();
      } else {
        setErr(t("userExists"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-slate-500">{t("email")}</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs text-slate-500">{t("role")}</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="admin">{t("roleAdmin")}</option>
          <option value="operator">{t("roleOperator")}</option>
          <option value="client">{t("roleClient")}</option>
        </select>
      </div>
      {role === "client" && (
        <div>
          <label className="block text-xs text-slate-500">{t("account")}</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">{t("selectAccount")}</option>
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
          </select>
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !email || (role === "client" && !accountId)}
        className="btn-primary"
      >
        {t("sendInvite")}
      </button>
      {msg && <span className="text-xs text-[#085041]">{msg}</span>}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
