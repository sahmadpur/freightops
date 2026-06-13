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
            className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-[10.5px] text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${positive ? "text-[#3b6d11]" : ""}`}>{value}</div>
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
    status === "paid" ? "bg-[#d4f2e7] text-[#085041]" :
    status === "partly_paid" ? "bg-[#fdefd1] text-[#633806]" :
    status === "not_paid" ? "bg-[#fde8df] text-[#712b13]" : "bg-slate-100 text-slate-500";

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
          <p className="mb-3 text-sm text-slate-400">{t("noPayments")}</p>
        ) : (
          <ul className="mb-3 divide-y divide-slate-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{formatMoney(toCents(p.amount))}</span>
                <span className="text-xs text-slate-400">
                  {new Date(p.paidAt).toISOString().slice(0, 10)}{p.note ? ` · ${p.note}` : ""}
                </span>
                <button type="button" onClick={() => remove(p.id)} className="text-xs text-red-700 hover:underline">
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
            className="mb-3.5 rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + {t("addPayment")}
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </CardBody>
    </Card>
  );
}
