"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function OrderDetailTabs({ info, history }: { info: React.ReactNode; history: React.ReactNode }) {
  const t = useTranslations("orders");
  const [tab, setTab] = useState<"info" | "history">("info");

  const tabCls = (active: boolean) =>
    `px-3.5 py-2 text-sm border-b-2 -mb-px ${active ? "border-[#1a3a5c] font-semibold text-[#1a3a5c]" : "border-transparent text-slate-500"}`;

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button type="button" className={tabCls(tab === "info")} onClick={() => setTab("info")}>{t("tabInfo")}</button>
        <button type="button" className={tabCls(tab === "history")} onClick={() => setTab("history")}>{t("tabHistory")}</button>
      </div>
      {tab === "info" ? info : history}
    </div>
  );
}
