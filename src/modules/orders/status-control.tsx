"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { changeOrderStatus } from "./actions";

const STATUSES = ["created", "received", "internal_transit", "loaded", "transit", "at_border", "at_customs", "arrived", "delivered", "closed"] as const;

export function StatusControl({ orderId, current }: { orderId: string; current: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const r = await changeOrderStatus(orderId, { status });
    setPending(false);
    if (r.ok) router.push(`/orders/${orderId}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={`${inputCls} min-w-0 flex-1`} value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((s) => (<option key={s} value={s}>{t(`status.${s}`)}</option>))}
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
  );
}
