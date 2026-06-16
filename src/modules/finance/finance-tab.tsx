"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, inputCls } from "@/components/ui/form";
import { formatMoney, toCents } from "@/lib/money";
import type { OrderFinance, OrderPayment } from "./queries";
import { addPayment, deletePayment, updateOrderFinancials } from "./actions";

type Side = "incoming" | "outgoing";

export function FinanceTab({ orderId, finance }: { orderId: string; finance: OrderFinance }) {
  const t = useTranslations("finance");
  const router = useRouter();

  const [amountReceivable, setAmountReceivable] = useState(finance.amountReceivable ?? "");
  const [amountPayable, setAmountPayable] = useState(finance.amountPayable ?? "");
  const [savingAmounts, setSavingAmounts] = useState(false);

  async function saveAmounts() {
    setSavingAmounts(true);
    const r = await updateOrderFinancials(orderId, { amountReceivable, amountPayable });
    setSavingAmounts(false);
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("actualProfit")}</span></CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label={t("amountReceivable")} value={formatMoney(finance.clientChargeCents)} />
            <Stat label="−" value={formatMoney(finance.carrierCostCents + finance.additionalCostsCents)} />
            <Stat label={t("actualProfit")} value={formatMoney(finance.actualProfitCents)} positive={finance.actualProfitCents >= 0} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("saveFinancials")}</span></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("amountReceivable")} htmlFor="ar">
              <input id="ar" className={inputCls} value={amountReceivable} onChange={(e) => setAmountReceivable(e.target.value)} />
            </Field>
            <Field label={t("amountPayable")} htmlFor="ap">
              <input id="ap" className={inputCls} value={amountPayable} onChange={(e) => setAmountPayable(e.target.value)} />
            </Field>
          </div>
          <button
            type="button"
            onClick={saveAmounts}
            disabled={savingAmounts}
            className="btn-primary"
          >
            {t("saveFinancials")}
          </button>
        </CardBody>
      </Card>

      <PaymentSection
        orderId={orderId}
        side="incoming"
        title={t("receivable")}
        invoicedCents={finance.receivable.invoicedCents}
        paidCents={finance.receivable.paidCents}
        deltaCents={finance.receivable.deltaCents}
        status={finance.receivable.status}
        payments={finance.incoming}
      />
      <PaymentSection
        orderId={orderId}
        side="outgoing"
        title={t("payable")}
        invoicedCents={finance.payable.invoicedCents}
        paidCents={finance.payable.paidCents}
        deltaCents={finance.payable.deltaCents}
        status={finance.payable.status}
        payments={finance.outgoing}
      />
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-[6px] bg-surface-hover px-3 py-2">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-soft">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function PaymentSection({
  orderId,
  side,
  title,
  invoicedCents,
  paidCents,
  deltaCents,
  status,
  payments,
}: {
  orderId: string;
  side: Side;
  title: string;
  invoicedCents: number;
  paidCents: number;
  deltaCents: number;
  status: "paid" | "partly_paid" | "not_paid" | null;
  payments: OrderPayment[];
}) {
  const t = useTranslations("finance");
  const tp = useTranslations("payStatus");
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setPending(true);
    setError(null);
    const r = await addPayment(orderId, { direction: side, amount, paidAt, note });
    setPending(false);
    if (r.ok) {
      setAmount(""); setPaidAt(""); setNote("");
      router.refresh();
    } else {
      setError(r.fieldErrors?.amount?.[0] ?? r.fieldErrors?.paidAt?.[0] ?? r.error ?? "Error");
    }
  }

  async function remove(id: string) {
    const r = await deletePayment(id);
    if (r.ok) router.refresh();
  }

  const statusColor =
    status === "paid"
      ? "bg-[rgb(var(--approval-approved-bg))] text-[rgb(var(--approval-approved-fg))]"
      : status === "partly_paid"
        ? "bg-[rgb(var(--approval-pending-bg))] text-[rgb(var(--approval-pending-fg))]"
        : status === "not_paid"
          ? "bg-[rgb(var(--approval-rejected-bg))] text-[rgb(var(--approval-rejected-fg))]"
          : "bg-surface-chip-active text-ink-soft";

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">{title}</span>
        {status && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>{tp(status)}</span>}
      </CardHeader>
      <CardBody>
        <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
          <Stat label={side === "incoming" ? t("amountReceivable") : t("amountPayable")} value={formatMoney(invoicedCents)} />
          <Stat label={side === "incoming" ? t("received") : t("paid")} value={formatMoney(paidCents)} />
          <Stat label={t("delta")} value={formatMoney(deltaCents)} positive={deltaCents <= 0} />
        </div>

        {payments.length === 0 ? (
          <p className="mb-3 text-sm text-ink-soft">{t("noPayments")}</p>
        ) : (
          <ul className="mb-3 divide-y divide-edge-soft text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="font-medium tabular-nums">{formatMoney(toCents(p.amount))}</span>
                <span className="font-mono text-[11px] text-ink-soft">
                  {new Date(p.paidAt).toISOString().slice(0, 10)}{p.note ? ` · ${p.note}` : ""}
                </span>
                <button type="button" onClick={() => remove(p.id)} className="text-xs text-[rgb(var(--danger-fg))] hover:underline">
                  {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("paymentAmount")} htmlFor={`amt-${side}`}>
            <input id={`amt-${side}`} className={`${inputCls} w-32`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t("paymentDate")} htmlFor={`dt-${side}`}>
            <input id={`dt-${side}`} type="date" className={`${inputCls} w-40`} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label={t("paymentNote")} htmlFor={`nt-${side}`}>
            <input id={`nt-${side}`} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="mb-3.5 btn-primary"
          >
            + {t("addPayment")}
          </button>
        </div>
        {error && <p className="text-sm text-[rgb(var(--danger-fg))]">{error}</p>}
      </CardBody>
    </Card>
  );
}
