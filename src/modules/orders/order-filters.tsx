"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { countryFlag, countryName } from "@/lib/countries";
import { TRANSPORT_TYPES } from "@/lib/transport-types";

export type OrderFilterValues = {
  accountId: string;
  carrierId: string;
  from: string;
  to: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  pay: string;
  payTo: string;
};

const PAY_STATUSES = ["paid", "partly_paid", "not_paid"] as const;

/**
 * URL-driven filter bar for the orders list. Submits as a plain GET form so
 * every filtered view is a shareable link and the server stays the only place
 * that knows how to filter. Collapsed by default unless something is active.
 */
export function OrderFilters({
  values,
  accountOpts,
  carrierOpts,
  countries,
  /** Preserved across filter changes so the text search isn't lost. */
  q,
  status,
  archived,
}: {
  values: OrderFilterValues;
  accountOpts: { id: string; title: string }[];
  carrierOpts: { id: string; title: string }[];
  countries: string[];
  q?: string;
  status?: string;
  archived?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const activeCount = Object.values(values).filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);
  const [v, setV] = useState(values);
  const set = (patch: Partial<OrderFilterValues>) => setV((s) => ({ ...s, ...patch }));

  const countryOpts: ComboOption[] = useMemo(
    () =>
      countries.map((code) => ({
        value: code,
        label: countryName(code, locale),
        prefix: countryFlag(code),
      })),
    [countries, locale],
  );

  const label = "mb-1 block font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft";

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action="/orders" className="flex flex-wrap items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {archived && <input type="hidden" name="archived" value="1" />}
          {/* Keep the active filters when only the search text changes. */}
          {Object.entries(values).map(([k, val]) =>
            val ? <input key={k} type="hidden" name={k} value={val} /> : null,
          )}
          <input
            name="q"
            defaultValue={q}
            placeholder={t("orders.searchPlaceholder")}
            className={`${inputCls} w-80`}
          />
        </form>
        <button type="button" className="btn-secondary" onClick={() => setOpen((o) => !o)}>
          {t("filters.toggle")}
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-brand-accent px-1.5 text-[10px] text-brand-deep">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <form
          action="/orders"
          className="mt-3 rounded-[8px] border border-edge-soft bg-surface-card p-4"
        >
          {q && <input type="hidden" name="q" value={q} />}
          {status && <input type="hidden" name="status" value={status} />}
          {archived && <input type="hidden" name="archived" value="1" />}
          {/* Comboboxes are not native inputs — mirror their value into hidden fields. */}
          <input type="hidden" name="accountId" value={v.accountId} />
          <input type="hidden" name="carrierId" value={v.carrierId} />
          <input type="hidden" name="from" value={v.from} />
          <input type="hidden" name="to" value={v.to} />

          <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className={label}>{t("fields.client")}</span>
              <Combobox
                value={v.accountId}
                onChange={(value) => set({ accountId: value })}
                options={accountOpts.map((a) => ({ value: a.id, label: a.title }))}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <span className={label}>{t("fields.carrier")}</span>
              <Combobox
                value={v.carrierId}
                onChange={(value) => set({ carrierId: value })}
                options={carrierOpts.map((c) => ({ value: c.id, label: c.title }))}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <span className={label}>{t("fields.fromCountry")}</span>
              <Combobox
                value={v.from}
                onChange={(value) => set({ from: value })}
                options={countryOpts}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <span className={label}>{t("fields.toCountry")}</span>
              <Combobox
                value={v.to}
                onChange={(value) => set({ to: value })}
                options={countryOpts}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <label className={label} htmlFor="f-type">{t("fields.transportType")}</label>
              <select
                id="f-type"
                name="type"
                className={inputCls}
                value={v.type}
                onChange={(e) => set({ type: e.target.value })}
              >
                <option value="">{t("filters.any")}</option>
                {TRANSPORT_TYPES.map((m) => (
                  <option key={m} value={m}>{t(`transportTypes.${m}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="f-datefrom">{t("filters.createdBetween")}</label>
              <div className="flex items-center gap-2">
                <input
                  id="f-datefrom"
                  type="date"
                  name="dateFrom"
                  className={inputCls}
                  value={v.dateFrom}
                  onChange={(e) => set({ dateFrom: e.target.value })}
                />
                <input
                  type="date"
                  name="dateTo"
                  aria-label={t("filters.createdBetween")}
                  className={inputCls}
                  value={v.dateTo}
                  onChange={(e) => set({ dateTo: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="f-pay">{t("fields.paidByCustomer")}</label>
              <select
                id="f-pay"
                name="pay"
                className={inputCls}
                value={v.pay}
                onChange={(e) => set({ pay: e.target.value })}
              >
                <option value="">{t("filters.any")}</option>
                {PAY_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`payStatus.${s}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="f-payto">{t("fields.paidToCarrier")}</label>
              <select
                id="f-payto"
                name="payTo"
                className={inputCls}
                value={v.payTo}
                onChange={(e) => set({ payTo: e.target.value })}
              >
                <option value="">{t("filters.any")}</option>
                {PAY_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`payStatus.${s}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Link href="/orders" className="btn-secondary">{t("filters.clear")}</Link>
            <button type="submit" className="btn-primary">{t("filters.apply")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
