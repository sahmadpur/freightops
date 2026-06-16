"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function OrderDetailTabs({
  info,
  finance,
  documents,
  comments,
  history,
}: {
  info: React.ReactNode;
  finance: React.ReactNode;
  documents: React.ReactNode;
  comments: React.ReactNode;
  history: React.ReactNode;
}) {
  const t = useTranslations("orders");
  const tf = useTranslations("finance");
  const tdoc = useTranslations("documents");
  const tc = useTranslations("comments");
  const [tab, setTab] = useState<"info" | "finance" | "documents" | "comments" | "history">("info");

  const tabCls = (active: boolean) =>
    `border-b-2 -mb-px px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edge-focus ${
      active ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"
    }`;

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-edge-soft">
        <button type="button" className={tabCls(tab === "info")} onClick={() => setTab("info")}>{t("tabInfo")}</button>
        <button type="button" className={tabCls(tab === "finance")} onClick={() => setTab("finance")}>{tf("tab")}</button>
        <button type="button" className={tabCls(tab === "documents")} onClick={() => setTab("documents")}>{tdoc("tab")}</button>
        <button type="button" className={tabCls(tab === "comments")} onClick={() => setTab("comments")}>{tc("tab")}</button>
        <button type="button" className={tabCls(tab === "history")} onClick={() => setTab("history")}>{t("tabHistory")}</button>
      </div>
      {tab === "info" ? info : tab === "finance" ? finance : tab === "documents" ? documents : tab === "comments" ? comments : history}
    </div>
  );
}
