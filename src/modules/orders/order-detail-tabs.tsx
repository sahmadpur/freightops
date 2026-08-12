"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Tab = "info" | "finance" | "documents" | "emails" | "tasks" | "comments" | "history";

export function OrderDetailTabs({
  info,
  finance,
  documents,
  emails,
  tasks,
  comments,
  history,
  initialTab,
}: {
  info: React.ReactNode;
  finance: React.ReactNode;
  documents: React.ReactNode;
  /** The source request's thread. Absent on an order that was never a request. */
  emails?: React.ReactNode;
  tasks: React.ReactNode;
  comments: React.ReactNode;
  history: React.ReactNode;
  /** Lets a link (e.g. the invoice-required banner) open a specific tab. */
  initialTab?: string;
}) {
  const t = useTranslations("orders");
  const tf = useTranslations("finance");
  const tdoc = useTranslations("documents");
  const tcomm = useTranslations("communications");
  const ttask = useTranslations("tasks");
  const tc = useTranslations("comments");

  const panels: { key: Tab; label: string; node: React.ReactNode }[] = [
    { key: "info", label: t("tabInfo"), node: info },
    { key: "finance", label: tf("tab"), node: finance },
    { key: "documents", label: tdoc("tab"), node: documents },
    ...(emails ? [{ key: "emails" as const, label: tcomm("tab"), node: emails }] : []),
    { key: "tasks", label: ttask("tab"), node: tasks },
    { key: "comments", label: tc("tab"), node: comments },
    { key: "history", label: t("tabHistory"), node: history },
  ];

  const [tab, setTab] = useState<Tab>(
    panels.some((p) => p.key === initialTab) ? (initialTab as Tab) : "info",
  );

  const tabCls = (active: boolean) =>
    `border-b-2 -mb-px px-3.5 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edge-focus ${
      active ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"
    }`;

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-edge-soft">
        {panels.map((p) => (
          <button key={p.key} type="button" className={tabCls(tab === p.key)} onClick={() => setTab(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      {panels.find((p) => p.key === tab)?.node}
    </div>
  );
}
