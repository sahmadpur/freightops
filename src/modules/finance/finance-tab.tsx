"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, inputCls } from "@/components/ui/form";
import { MoneyDual } from "@/components/ui/money";
import { formatMoney, toCents } from "@/lib/money";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import type { FinanceLine, OrderFinance, OrderPayment } from "./queries";
import {
  addFinanceLine,
  addPayment,
  deleteFinanceLine,
  deletePayment,
  updateOrderFinancials,
} from "./actions";

type Side = "incoming" | "outgoing";

export function FinanceTab({
  orderId,
  currency,
  finance,
}: {
  orderId: string;
  currency: string;
  finance: OrderFinance;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const rate = finance.exchangeRate;

  const [amountReceivable, setAmountReceivable] = useState(finance.amountReceivable ?? "");
  const [amountPayable, setAmountPayable] = useState(finance.amountPayable ?? "");
  const [carrierInvoiceNumber, setCarrierInvoiceNumber] = useState(finance.carrierInvoiceNumber ?? "");
  const [carrierInvoiceDate, setCarrierInvoiceDate] = useState(finance.carrierInvoiceDate ?? "");
  const [savingAmounts, setSavingAmounts] = useState(false);

  async function saveAmounts() {
    setSavingAmounts(true);
    const r = await updateOrderFinancials(orderId, {
      amountReceivable,
      amountPayable,
      carrierInvoiceNumber,
      carrierInvoiceDate,
    });
    setSavingAmounts(false);
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("expectedProfit")}</span></CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label={t("revenue")} value={<MoneyDual cents={finance.clientChargeCents} currency={currency} rate={rate} />} />
            <Stat label={t("carrierCost")} value={<MoneyDual cents={finance.carrierCostCents} currency={currency} rate={rate} />} />
            <Stat
              label={t("expectedProfit")}
              value={<MoneyDual cents={finance.expectedProfitCents} currency={currency} rate={rate} />}
              positive={finance.expectedProfitCents >= 0}
            />
          </div>
        </CardBody>
      </Card>

      <FinanceLines orderId={orderId} side="revenue" title={t("revenueLines")} lines={finance.revenueLines} totalCents={finance.clientChargeCents} rate={rate} currency={currency} />
      <FinanceLines orderId={orderId} side="cost" title={t("agentExpenses")} lines={finance.costLines} totalCents={finance.carrierCostCents} rate={rate} currency={currency} />

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("actualProfit")}</span></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("amountReceivable")} htmlFor="ar">
              <input id="ar" className={inputCls} value={amountReceivable} onChange={(e) => setAmountReceivable(e.target.value)} />
            </Field>
            <Field label={t("amountPayable")} htmlFor="ap">
              <input id="ap" className={inputCls} value={amountPayable} onChange={(e) => setAmountPayable(e.target.value)} />
            </Field>
            <Field label={t("carrierInvoiceNumber")} htmlFor="cin">
              <input id="cin" className={inputCls} value={carrierInvoiceNumber} onChange={(e) => setCarrierInvoiceNumber(e.target.value)} />
            </Field>
            <Field label={t("carrierInvoiceDate")} htmlFor="cid">
              <input id="cid" type="date" className={inputCls} value={carrierInvoiceDate} onChange={(e) => setCarrierInvoiceDate(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <button type="button" onClick={saveAmounts} disabled={savingAmounts} className="btn-primary">
              {t("saveFinancials")}
            </button>
            <Stat
              label={t("actualProfit")}
              value={<MoneyDual cents={finance.settledProfitCents} currency={currency} rate={rate} />}
              positive={finance.settledProfitCents >= 0}
            />
          </div>
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
        currency={currency}
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
        currency={currency}
      />

      <CashLedger incoming={finance.incoming} outgoing={finance.outgoing} currency={currency} />
    </div>
  );
}

/**
 * Merge both payment directions into one date-ordered list, signing each amount
 * and carrying the running net position. Pure, so the component stays free of
 * mid-render mutation.
 */
function withRunningBalance(incoming: OrderPayment[], outgoing: OrderPayment[]) {
  const entries = [...incoming, ...outgoing].sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
  );
  return entries.reduce<(OrderPayment & { signed: number; running: number })[]>((acc, p) => {
    const signed = p.direction === "incoming" ? toCents(p.amount) : -toCents(p.amount);
    const running = (acc.length > 0 ? acc[acc.length - 1].running : 0) + signed;
    acc.push({ ...p, signed, running });
    return acc;
  }, []);
}

/**
 * One chronological log of money in and money out (requirement #14), with who
 * recorded each entry and the running net position after it.
 */
function CashLedger({
  incoming,
  outgoing,
  currency,
}: {
  incoming: OrderPayment[];
  outgoing: OrderPayment[];
  currency: string;
}) {
  const t = useTranslations("finance");
  const rows = withRunningBalance(incoming, outgoing);
  const net = rows.length > 0 ? rows[rows.length - 1].running : 0;

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">{t("ledger")}</span>
        <span className="text-sm font-semibold tabular-nums">{formatMoney(net, currency)}</span>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("noPayments")}</p>
        ) : (
          <ul className="divide-y divide-edge-soft text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.direction === "incoming"
                        ? "bg-[rgb(var(--approval-approved-bg))] text-[rgb(var(--approval-approved-fg))]"
                        : "bg-[rgb(var(--approval-rejected-bg))] text-[rgb(var(--approval-rejected-fg))]"
                    }`}
                  >
                    {r.direction === "incoming" ? t("received") : t("paid")}
                  </span>
                  <span className="font-mono text-[11px] text-ink-soft">
                    {new Date(r.paidAt).toISOString().slice(0, 10)}
                    {r.recordedBy ? ` · ${t("recordedBy", { name: r.recordedBy })}` : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  <span className={r.signed >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {r.signed >= 0 ? "+" : "−"}
                    {formatMoney(Math.abs(r.signed), currency)}
                  </span>
                  <span className="ml-3 text-ink-soft">{formatMoney(r.running, currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({ label, value, positive }: { label: string; value: React.ReactNode; positive?: boolean }) {
  return (
    <div className="rounded-[12px] bg-surface-hover px-3 py-2">
      <div className="text-[11.5px] font-medium text-ink-soft">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-ink"}`}>{value}</div>
    </div>
  );
}

/** Editable itemized list of revenue or cost lines for the order (#13). */
function FinanceLines({
  orderId,
  side,
  title,
  lines,
  totalCents,
  rate,
  currency,
}: {
  orderId: string;
  side: "revenue" | "cost";
  title: string;
  lines: FinanceLine[];
  totalCents: number;
  rate: string | null;
  currency: string;
}) {
  const t = useTranslations("finance");
  const tc = useTranslations("financeCategory");
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("other");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setPending(true);
    setError(null);
    const r = await addFinanceLine(orderId, { side, category, description, amount, note });
    setPending(false);
    if (r.ok) {
      setDescription(""); setAmount(""); setNote(""); setCategory("other");
      router.refresh();
    } else {
      setError(r.fieldErrors?.description?.[0] ?? r.fieldErrors?.amount?.[0] ?? r.error ?? "Error");
    }
  }

  async function remove(id: string) {
    const r = await deleteFinanceLine(id);
    if (r.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-sm font-semibold tabular-nums"><MoneyDual cents={totalCents} currency={currency} rate={rate} /></span>
      </CardHeader>
      <CardBody>
        {lines.length === 0 ? (
          <p className="mb-3 text-sm text-ink-soft">{t("noLines")}</p>
        ) : (
          <ul className="mb-3 divide-y divide-edge-soft text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex-1 truncate">
                  {side === "cost" && (
                    <span className="mr-2 rounded-full bg-surface-chip-active px-2 py-0.5 text-[11px] text-ink-soft">
                      {tc(l.category)}
                    </span>
                  )}
                  {/* A note-less create-form expense stores its category as the
                      description; the chip already says that, so don't repeat it. */}
                  {l.description === l.category ? null : l.description}
                  {l.note ? <span className="ml-2 text-xs text-ink-soft">· {l.note}</span> : null}
                </span>
                <span className="tabular-nums"><MoneyDual cents={toCents(l.amount)} currency={currency} rate={rate} /></span>
                <button type="button" onClick={() => remove(l.id)} className="text-xs text-[rgb(var(--danger-fg))] hover:underline">
                  {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          {side === "cost" && (
            <Field label={t("expenseCategory")} htmlFor={`cat-${side}`}>
              <select
                id={`cat-${side}`}
                className={`${inputCls} w-44`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {FINANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{tc(c)}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t("lineDescription")} htmlFor={`desc-${side}`}>
            <input id={`desc-${side}`} className={`${inputCls} w-56`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label={t("lineAmount")} htmlFor={`amt-${side}`}>
            <input id={`amt-${side}`} className={`${inputCls} w-32`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t("lineNote")} htmlFor={`note-${side}`}>
            <input id={`note-${side}`} className={`${inputCls} w-40`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button type="button" onClick={add} disabled={pending} className="mb-3.5 btn-primary">
            + {t("addLine")}
          </button>
        </div>
        {error && <p className="text-sm text-[rgb(var(--danger-fg))]">{error}</p>}
      </CardBody>
    </Card>
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
  currency,
}: {
  orderId: string;
  side: Side;
  title: string;
  invoicedCents: number;
  paidCents: number;
  deltaCents: number;
  status: "paid" | "partly_paid" | "not_paid" | null;
  payments: OrderPayment[];
  currency: string;
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
          <Stat label={side === "incoming" ? t("amountReceivable") : t("amountPayable")} value={formatMoney(invoicedCents, currency)} />
          <Stat label={side === "incoming" ? t("received") : t("paid")} value={formatMoney(paidCents, currency)} />
          <Stat label={t("delta")} value={formatMoney(deltaCents, currency)} positive={deltaCents <= 0} />
        </div>

        {payments.length === 0 ? (
          <p className="mb-3 text-sm text-ink-soft">{t("noPayments")}</p>
        ) : (
          <ul className="mb-3 divide-y divide-edge-soft text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="font-medium tabular-nums">{formatMoney(toCents(p.amount), currency)}</span>
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
