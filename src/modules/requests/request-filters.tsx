"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { inputCls } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { countryFlag, countryName } from "@/lib/countries";
import { LEAD_SOURCES } from "@/lib/lead-source";
import { TRANSPORT_FAMILIES } from "@/lib/transport-matrix";

/** Only the countries actually in use, so the dropdown isn't the whole world. */
const toOpts = (codes: string[], locale: string): ComboOption[] =>
  codes.map((code) => ({ value: code, label: countryName(code, locale), prefix: countryFlag(code) }));

export type RequestFilterValues = {
  accountId: string;
  responsibleUserId: string;
  source: string;
  family: string;
  from: string;
  to: string;
  dateFrom: string;
  dateTo: string;
};

/**
 * URL-driven filter bar for the requests list — the §21 filter set. A plain GET
 * form, like the orders one, so every filtered view is a shareable link and the
 * server remains the only place that knows how to filter.
 */
export function RequestFilters({
  values,
  accountOpts,
  staffOpts,
  fromCountries,
  toCountries,
  q,
  status,
  archived,
}: {
  values: RequestFilterValues;
  accountOpts: ComboOption[];
  staffOpts: ComboOption[];
  fromCountries: string[];
  toCountries: string[];
  q?: string;
  status?: string;
  archived?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const activeCount = Object.values(values).filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);
  const [v, setV] = useState(values);
  const set = (patch: Partial<RequestFilterValues>) => setV((s) => ({ ...s, ...patch }));

  const fromOpts = useMemo(() => toOpts(fromCountries, locale), [fromCountries, locale]);
  const destOpts = useMemo(() => toOpts(toCountries, locale), [toCountries, locale]);

  const label = "mb-1 block text-[11.5px] font-medium text-ink-soft";

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action="/requests" className="flex flex-wrap items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {archived && <input type="hidden" name="archived" value="1" />}
          {/* Keep the active filters when only the search text changes. */}
          {Object.entries(values).map(([k, val]) =>
            val ? <input key={k} type="hidden" name={k} value={val} /> : null,
          )}
          <input
            name="q"
            defaultValue={q}
            placeholder={t("requests.searchPlaceholder")}
            className={`${inputCls} w-96`}
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
        <form action="/requests" className="mt-3 rounded-[10px] border border-edge-soft bg-surface-card p-4">
          {q && <input type="hidden" name="q" value={q} />}
          {status && <input type="hidden" name="status" value={status} />}
          {archived && <input type="hidden" name="archived" value="1" />}
          {/* Comboboxes are not native inputs — mirror their value into hidden fields. */}
          <input type="hidden" name="accountId" value={v.accountId} />
          <input type="hidden" name="responsibleUserId" value={v.responsibleUserId} />
          <input type="hidden" name="from" value={v.from} />
          <input type="hidden" name="to" value={v.to} />

          <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className={label}>{t("fields.client")}</span>
              <Combobox
                value={v.accountId}
                onChange={(value) => set({ accountId: value })}
                options={accountOpts}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <span className={label}>{t("fields.responsibleManager")}</span>
              <Combobox
                value={v.responsibleUserId}
                onChange={(value) => set({ responsibleUserId: value })}
                options={staffOpts}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <span className={label}>{t("fields.originCountry")}</span>
              <Combobox
                value={v.from}
                onChange={(value) => set({ from: value })}
                options={fromOpts}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <span className={label}>{t("fields.destinationCountry")}</span>
              <Combobox
                value={v.to}
                onChange={(value) => set({ to: value })}
                options={destOpts}
                placeholder={t("filters.any")}
                emptyLabel={t("common.noResults")}
              />
            </div>
            <div>
              <label className={label} htmlFor="f-source">{t("fields.leadSource")}</label>
              <select
                id="f-source"
                name="source"
                className={inputCls}
                value={v.source}
                onChange={(e) => set({ source: e.target.value })}
              >
                <option value="">{t("filters.any")}</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{t(`leadSource.${s}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="f-family">{t("fields.transportType")}</label>
              <select
                id="f-family"
                name="family"
                className={inputCls}
                value={v.family}
                onChange={(e) => set({ family: e.target.value })}
              >
                <option value="">{t("filters.any")}</option>
                {TRANSPORT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{t(`transportFamily.${f}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="f-datefrom">{t("filters.receivedBetween")}</label>
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
                  aria-label={t("filters.receivedBetween")}
                  className={inputCls}
                  value={v.dateTo}
                  onChange={(e) => set({ dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Link href="/requests" className="btn-secondary">{t("filters.clear")}</Link>
            <button type="submit" className="btn-primary">{t("filters.apply")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
