"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyDual } from "@/components/ui/money";
import { changeOrderStatus } from "@/modules/orders/actions";
import type { PaymentStatus } from "@/lib/finance";
import type { ReconciliationRow, ReconciliationSide } from "./queries";

const STATUSES = ["created", "received", "internal_transit", "loaded", "transit", "at_border", "at_customs", "arrived", "delivered", "closed"] as const;

export function ReconciliationReport({ rows }: { rows: ReconciliationRow[] }) {
  const t = useTranslations();
  // Empty selection = all statuses (the multi-select "Update status" filter, #15).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = selected.size === 0 ? rows : rows.filter((r) => selected.has(r.status));

  const toggle = (s: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <Card>
      <CardHeader><span className="text-sm font-semibold">{t("finance.reportOfAccounts")}</span></CardHeader>
      <CardBody>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-ink-soft">{t("finance.filterByStatus")}:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${selected.has(s) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
            >
              {t(`status.${s}`)}
            </button>
          ))}
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="ml-1 text-[11px] text-brand hover:underline">
              {t("finance.clearFilter")}
            </button>
          )}
        </div>

        <SideTable title={t("finance.clients")} party={t("fields.client")} rows={filtered} side="receivable" />
        <div className="h-4" />
        <SideTable title={t("finance.carriers")} party={t("fields.carrier")} rows={filtered} side="payable" />
      </CardBody>
    </Card>
  );
}

function SideTable({
  title,
  party,
  rows,
  side,
}: {
  title: string;
  party: string;
  rows: ReconciliationRow[];
  side: "receivable" | "payable";
}) {
  const t = useTranslations();
  const visible = rows.filter((r) => {
    const s = side === "receivable" ? r.receivable : r.payable;
    return s.invoicedCents > 0 || s.paidCents > 0;
  });
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-soft">
              <th className="py-1.5 pr-3 font-semibold">{t("finance.orderDetails")}</th>
              <th className="py-1.5 pr-3 font-semibold">{party}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{side === "receivable" ? t("finance.amountReceivable") : t("finance.amountPayable")}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{t("finance.paid")}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{t("finance.delta")}</th>
              <th className="py-1.5 pr-3 font-semibold">{t("orders.updateStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={6} className="py-3 text-ink-soft">{t("finance.noRows")}</td></tr>
            ) : (
              visible.map((r) => {
                const s: ReconciliationSide = side === "receivable" ? r.receivable : r.payable;
                return (
                  <tr key={r.id} className="border-t border-edge-soft">
                    <td className="py-1.5 pr-3">
                      <a href={`/orders/${r.id}`} className="font-medium text-brand hover:underline">{r.number}</a>
                      <span className="ml-2 text-ink-soft">{r.title}</span>
                    </td>
                    <td className="py-1.5 pr-3">{side === "receivable" ? r.accountTitle : (r.carrierTitle ?? "—")}</td>
                    <td className="py-1.5 pr-3 text-right"><MoneyDual usdCents={s.invoicedCents} rate={r.exchangeRate} /></td>
                    <td className="py-1.5 pr-3 text-right"><MoneyDual usdCents={s.paidCents} rate={r.exchangeRate} /></td>
                    <td className="py-1.5 pr-3 text-right"><MoneyDual usdCents={s.deltaCents} rate={r.exchangeRate} /></td>
                    <td className="py-1.5 pr-3">
                      <InlineStatus orderId={r.id} current={r.status} status={s.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InlineStatus({ orderId, current, status }: { orderId: string; current: string; status: PaymentStatus | null }) {
  const t = useTranslations();
  const tp = useTranslations("payStatus");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onChange(next: string) {
    if (next === current) return;
    setPending(true);
    const r = await changeOrderStatus(orderId, { status: next });
    setPending(false);
    if (r.ok) router.refresh();
  }

  const pillColor =
    status === "paid"
      ? "text-[rgb(var(--approval-approved-fg))]"
      : status === "partly_paid"
        ? "text-[rgb(var(--approval-pending-fg))]"
        : status === "not_paid"
          ? "text-[rgb(var(--approval-rejected-fg))]"
          : "text-ink-soft";

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[5px] border border-edge-chip bg-surface-card px-1.5 py-0.5 text-xs text-ink outline-none focus:border-edge-focus"
      >
        {STATUSES.map((s) => (<option key={s} value={s}>{t(`status.${s}`)}</option>))}
      </select>
      {status && <span className={`text-[10px] ${pillColor}`}>{tp(status)}</span>}
    </div>
  );
}
