"use client";

import { useTranslations } from "next-intl";
import { Field, inputCls } from "@/components/ui/form";
import { Combobox, MultiCombobox, type ComboOption } from "@/components/ui/combobox";
import { ORDER_CURRENCIES } from "@/lib/fx";
import { PACKAGING_TYPES } from "@/lib/packaging-types";
import { STACKABLE_VALUES } from "@/lib/transport-matrix";
import { emptyDimension, type CargoDraft, type DimensionDraft } from "./request-form-initial";

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-3.5 flex cursor-pointer items-center gap-2 text-[13px] text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-edge-chip accent-[rgb(var(--brand))]"
      />
      {label}
    </label>
  );
}

/**
 * The §9 cargo block, shown for every transport type. The three conditional
 * sub-blocks — dangerous goods, temperature control, oversized — only exist
 * while their flag is on, and the action clears their columns when it is turned
 * off, so the form and the row can't disagree about what was declared.
 */
export function CargoEditor({
  cargo,
  onChange,
  errors,
  suggestTempControl = false,
  cargoTypeOpts = [],
}: {
  cargo: CargoDraft;
  onChange: (next: CargoDraft) => void;
  errors: Record<string, string[]>;
  /** §8: reefer equipment on a leg suggests — never forces — temperature control. */
  suggestTempControl?: boolean;
  /** The admin-managed cargo-description dictionary; free text stays allowed. */
  cargoTypeOpts?: ComboOption[];
}) {
  const t = useTranslations("fields");
  const tr = useTranslations("requests");
  const tst = useTranslations("stackable");
  const tpk = useTranslations("packagingType");
  const set = (patch: Partial<CargoDraft>) => onChange({ ...cargo, ...patch });

  const setDim = (i: number, patch: Partial<DimensionDraft>) =>
    set({ dimensions: cargo.dimensions.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });

  return (
    <>
      <Field label={t("cargoDescription")} error={errors.description}>
        <Combobox
          value={cargo.description}
          onChange={(v) => set({ description: v })}
          options={cargoTypeOpts}
          creatable
        />
      </Field>

      <div className={gridCls}>
        <Field label={t("hsCode")} error={errors.hsCodes}>
          <MultiCombobox values={cargo.hsCodes} onChange={(v) => set({ hsCodes: v })} options={[]} creatable />
        </Field>
        <Field label={t("packages")} error={errors.packages}>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={cargo.packages}
            onChange={(e) => set({ packages: e.target.value })}
          />
        </Field>
        <Field label={t("packagingType")} error={errors.packagingType}>
          <Combobox
            value={cargo.packagingType}
            onChange={(v) => set({ packagingType: v })}
            options={PACKAGING_TYPES.map((p) => ({ value: p, label: tpk(p) }))}
          />
        </Field>
        <Field label={t("grossWeight")} error={errors.grossWeightKg}>
          <input
            className={inputCls}
            value={cargo.grossWeightKg}
            onChange={(e) => set({ grossWeightKg: e.target.value })}
          />
        </Field>
        <Field label={t("volumeM3")} error={errors.volumeM3}>
          <input className={inputCls} value={cargo.volumeM3} onChange={(e) => set({ volumeM3: e.target.value })} />
        </Field>
        <Field label={t("cargoValue")} error={errors.cargoValue}>
          <input className={inputCls} value={cargo.cargoValue} onChange={(e) => set({ cargoValue: e.target.value })} />
        </Field>
        <Field label={t("currency")} error={errors.cargoCurrency}>
          <Combobox
            value={cargo.cargoCurrency}
            onChange={(v) => set({ cargoCurrency: v })}
            options={ORDER_CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label={t("stackable")} error={errors.stackable}>
          <Combobox
            value={cargo.stackable}
            onChange={(v) => set({ stackable: v })}
            options={STACKABLE_VALUES.map((v) => ({ value: v, label: tst(v) }))}
          />
        </Field>
      </div>

      <Field label={t("dimensions")} error={errors.dimensions}>
        <div className="space-y-2">
          {cargo.dimensions.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputCls}
                placeholder={t("length")}
                value={d.lengthCm}
                onChange={(e) => setDim(i, { lengthCm: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder={t("width")}
                value={d.widthCm}
                onChange={(e) => setDim(i, { widthCm: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder={t("height")}
                value={d.heightCm}
                onChange={(e) => setDim(i, { heightCm: e.target.value })}
              />
              <input
                type="number"
                min={1}
                className={`${inputCls} max-w-[90px]`}
                placeholder={t("quantity")}
                value={d.quantity}
                onChange={(e) => setDim(i, { quantity: e.target.value })}
              />
              <button
                type="button"
                onClick={() => set({ dimensions: cargo.dimensions.filter((_, idx) => idx !== i) })}
                className="shrink-0 text-xs text-[rgb(var(--danger-fg))] hover:underline"
              >
                {t("remove")}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ dimensions: [...cargo.dimensions, emptyDimension()] })}
            className="text-xs text-brand hover:underline"
          >
            + {t("addDimension")}
          </button>
        </div>
      </Field>

      {suggestTempControl && !cargo.temperatureControlled && (
        <p className="mb-3.5 flex flex-wrap items-center gap-2 rounded-control border border-edge-chip bg-surface-hover px-3 py-2 text-[12px] text-ink-soft">
          {tr("reeferSuggest")}
          <button
            type="button"
            onClick={() => set({ temperatureControlled: true })}
            className="text-brand hover:underline"
          >
            {tr("reeferSuggestApply")}
          </button>
        </p>
      )}

      <div className={gridCls}>
        <Toggle
          label={t("dangerousGoods")}
          checked={cargo.dangerousGoods}
          onChange={(v) => set({ dangerousGoods: v })}
        />
        <Toggle
          label={t("temperatureControlled")}
          checked={cargo.temperatureControlled}
          onChange={(v) => set({ temperatureControlled: v })}
        />
        <Toggle label={t("oversized")} checked={cargo.oversized} onChange={(v) => set({ oversized: v })} />
      </div>

      {cargo.dangerousGoods && (
        <div className={gridCls}>
          <Field label={t("dgClass")} error={errors.dgClass}>
            <input className={inputCls} value={cargo.dgClass} onChange={(e) => set({ dgClass: e.target.value })} />
          </Field>
          <Field label={t("unNumber")} error={errors.unNumber}>
            <input className={inputCls} value={cargo.unNumber} onChange={(e) => set({ unNumber: e.target.value })} />
          </Field>
          <Field label={t("dgNotes")} error={errors.dgNotes}>
            <input className={inputCls} value={cargo.dgNotes} onChange={(e) => set({ dgNotes: e.target.value })} />
          </Field>
        </div>
      )}

      {cargo.temperatureControlled && (
        <div className={gridCls}>
          <Field label={t("tempMin")} error={errors.tempMinC}>
            <input className={inputCls} value={cargo.tempMinC} onChange={(e) => set({ tempMinC: e.target.value })} />
          </Field>
          <Field label={t("tempMax")} error={errors.tempMaxC}>
            <input className={inputCls} value={cargo.tempMaxC} onChange={(e) => set({ tempMaxC: e.target.value })} />
          </Field>
        </div>
      )}

      {cargo.oversized && (
        <Field label={t("oversizedNotes")} error={errors.oversizedNotes}>
          <input
            className={inputCls}
            value={cargo.oversizedNotes}
            onChange={(e) => set({ oversizedNotes: e.target.value })}
          />
        </Field>
      )}
    </>
  );
}
