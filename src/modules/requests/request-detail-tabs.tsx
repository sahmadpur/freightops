"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Tab = "overview" | "quotation" | "emails" | "documents" | "history";

const TABS: readonly Tab[] = ["overview", "quotation", "emails", "documents", "history"];

/**
 * Presentational shell only: every panel is rendered on the server and handed
 * in as a node, so switching tabs costs nothing and the page stays one round
 * trip. `initialTab` lets a link open a specific panel.
 */
export function RequestDetailTabs({
  overview,
  quotation,
  emails,
  documents,
  history,
  initialTab,
}: {
  overview: React.ReactNode;
  quotation: React.ReactNode;
  emails: React.ReactNode;
  documents: React.ReactNode;
  history: React.ReactNode;
  initialTab?: string;
}) {
  const t = useTranslations("requests");
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview");

  const tabCls = (active: boolean) =>
    `border-b-2 -mb-px px-3.5 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edge-focus ${
      active ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"
    }`;

  const label: Record<Tab, string> = {
    overview: t("tabOverview"),
    quotation: t("tabQuotation"),
    emails: t("tabEmails"),
    documents: t("tabDocuments"),
    history: t("tabHistory"),
  };

  const panel: Record<Tab, React.ReactNode> = { overview, quotation, emails, documents, history };

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-edge-soft">
        {TABS.map((name) => (
          <button key={name} type="button" className={tabCls(tab === name)} onClick={() => setTab(name)}>
            {label[name]}
          </button>
        ))}
      </div>
      {panel[tab]}
    </div>
  );
}
