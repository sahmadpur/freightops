"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { convertToOrder } from "./actions";
import type { ActionResult } from "./schema";

/**
 * The §14 "Create order" control. The two paths are offered as an explicit
 * choice rather than inferred, because the difference matters to the desk:
 * converting from a quotation carries the agreed price across, while a direct
 * order is deliberately created with no price at all (§16).
 */
export function ConvertControl({
  requestId,
  hasQuotation,
  carrierOpts,
}: {
  requestId: string;
  hasQuotation: boolean;
  carrierOpts: ComboOption[];
}) {
  const t = useTranslations("requests");
  const tf = useTranslations("fields");
  const ta = useTranslations("actions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(hasQuotation ? "from_quotation" : "direct");
  const [carrierId, setCarrierId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function convert() {
    setPending(true);
    const r = await convertToOrder(requestId, { mode, carrierId });
    setPending(false);
    setResult(r);
    if (r.ok) router.push(`/orders/${r.id}`);
  }

  const message = (error: string) =>
    error === "no_quotation"
      ? t("convertNoQuotation")
      : error === "no_client"
        ? t("convertNoClient")
        : error === "already_converted"
          ? t("convertAlready")
          : error;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">
        {t("convertToOrder")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)} aria-label={t("convertToOrder")}>
        <option value="from_quotation" disabled={!hasQuotation}>
          {t("convertFromQuotation")}
        </option>
        <option value="direct">{t("convertDirect")}</option>
      </select>
      {/* Optional: the carrier is usually picked later, during Operations. */}
      <Combobox
        value={carrierId}
        onChange={setCarrierId}
        options={carrierOpts}
        placeholder={tf("selectCarrier")}
      />
      <p className="text-[11.5px] text-ink-soft">
        {mode === "direct" ? t("convertDirectHint") : t("convertFromQuotationHint")}
      </p>
      {result && !result.ok && result.error && (
        <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">{message(result.error)}</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={convert} disabled={pending} className="btn-primary flex-1">
          {pending ? ta("saving") : t("convertToOrder")}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
          {ta("cancel")}
        </button>
      </div>
    </div>
  );
}
