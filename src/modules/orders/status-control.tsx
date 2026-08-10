"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { ORDER_STATUSES } from "@/lib/order-status";
import { changeOrderStatus } from "./actions";
import type { ActionResult } from "@/lib/forms";

export function StatusControl({ orderId, current }: { orderId: string; current: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function save() {
    setPending(true);
    const r = await changeOrderStatus(orderId, { status });
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/orders/${orderId}`);
  }

  // §16 refuses to close an order whose money is not recorded. Without this the
  // Save button would appear to do nothing at all.
  const blocked = result && !result.ok && result.error === "financial_data_incomplete";
  const missing = blocked ? ((result.fieldErrors?.status ?? []) as string[]) : [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} min-w-0 flex-1`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{t(`status.${s}`)}</option>))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={pending || status === current}
          className="btn-primary"
        >
          {pending ? t("actions.saving") : t("actions.save")}
        </button>
      </div>
      {blocked && (
        <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">
          {t("orders.financialDataIncomplete")}{" "}
          {missing.map((f) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f)).join(", ")}
        </p>
      )}
    </div>
  );
}
