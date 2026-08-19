"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Field, inputCls } from "@/components/ui/form";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { citiesFor } from "@/lib/cities";
import { countryOptions } from "@/lib/countries";
import {
  chargeableWeight,
  DEFAULT_VOLUMETRIC_DIVISOR,
  legFields,
  LEG_TRANSPORT_TYPES,
  subtypesFor,
  VEHICLE_TYPES,
  WAGON_TYPES,
  type LegTransportType,
  type PointKind,
} from "@/lib/transport-matrix";
import {
  emptyLeg,
  hasEquipmentData,
  resetLegEquipment,
  type CargoDraft,
  type LegDraft,
} from "./request-form-initial";

/** Form string → number, or null when empty/garbage. */
const num = (s: string): number | null => {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};

const gridCls = "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3";

/** The labels for a leg's origin/destination "point", which change with the transport type. */
const POINT_LABELS: Record<PointKind, { origin: string; destination: string }> = {
  port: { origin: "portOfLoading", destination: "portOfDischarge" },
  station: { origin: "originStation", destination: "destinationStation" },
  airport: { origin: "originAirport", destination: "destinationAirport" },
};

/**
 * One leg's inputs. Which of them exist is decided entirely by `legFields()`,
 * so this component never carries its own copy of the Appendix A matrix —
 * unrelated fields are not rendered at all, as §8 and §24 require.
 */
function LegBody({
  leg,
  cargo,
  onChange,
  errors,
  showTypePicker,
}: {
  leg: LegDraft;
  cargo: CargoDraft;
  onChange: (next: LegDraft) => void;
  errors: Record<string, string[]>;
  showTypePicker: boolean;
}) {
  const t = useTranslations("fields");
  const tr = useTranslations("requests");
  const tf = useTranslations("transportFamily");
  const ts = useTranslations("transportSubtype");
  const tv = useTranslations("vehicleType");
  const tc = useTranslations("containerType");
  const tw = useTranslations("wagonType");
  const trp = useTranslations("routingPreference");
  const locale = useLocale();

  const countries = useMemo(() => countryOptions(locale), [locale]);
  const fields = legFields(leg.transportType, leg.subtype);
  const set = (patch: Partial<LegDraft>) => onChange({ ...leg, ...patch });

  /**
   * §8.4 chargeable weight, prefilled from cargo weight/volume and the leg's
   * divisor. Same contract as the generated title: once the user edits the
   * field, the calculator stops overwriting it.
   */
  const [cwTouched, setCwTouched] = useState(leg.chargeableWeightKg.trim() !== "");
  const autoCw = chargeableWeight(
    num(cargo.grossWeightKg),
    num(cargo.volumeM3),
    num(leg.volumetricDivisor) ?? DEFAULT_VOLUMETRIC_DIVISOR,
  );
  const autoCwStr = autoCw === null ? "" : String(Math.round(autoCw * 100) / 100);
  useEffect(() => {
    if (fields.air && !cwTouched && leg.chargeableWeightKg !== autoCwStr) {
      set({ chargeableWeightKg: autoCwStr });
    }
  });

  function changeType(next: string) {
    if (!LEG_TRANSPORT_TYPES.includes(next as LegTransportType)) return;
    const type = next as LegTransportType;
    if (type === leg.transportType) return;
    // §24: warn before discarding subtype-specific data, but only when there is
    // something to discard — an untouched leg switches silently.
    if (hasEquipmentData(leg) && !window.confirm(tr("clearSubtypeWarning"))) return;
    onChange(resetLegEquipment(leg, type));
  }

  const subtypes = subtypesFor(leg.transportType);
  const opt = (values: readonly string[], label: (v: string) => string): ComboOption[] =>
    values.map((v) => ({ value: v, label: label(v) }));

  return (
    <>
      <div className={gridCls}>
        {showTypePicker && (
          <Field label={t("transportType")} error={errors.transportType}>
            <Combobox
              value={leg.transportType}
              onChange={changeType}
              options={opt(LEG_TRANSPORT_TYPES, (v) => tf(v))}
              clearable={false}
            />
          </Field>
        )}
        {subtypes.length > 0 && (
          <Field label={t("transportSubtype")} error={errors.subtype}>
            <Combobox
              value={leg.subtype}
              onChange={(v) => set({ ...resetLegEquipment(leg, leg.transportType), subtype: v })}
              options={opt(subtypes, (v) => ts(v))}
            />
          </Field>
        )}
      </div>

      <div className={gridCls}>
        <Field label={t("originCountry")} error={errors.originCountry}>
          <Combobox
            value={leg.originCountry}
            // A city belongs to its country, so changing the country resets it.
            onChange={(v) => set({ originCountry: v, originCity: "" })}
            options={countries}
            placeholder={t("selectCountry")}
          />
        </Field>
        <Field label={t("originCity")} error={errors.originCity}>
          <Combobox
            value={leg.originCity}
            onChange={(v) => set({ originCity: v })}
            options={citiesFor(leg.originCountry).map((c) => ({ value: c, label: c }))}
            creatable
          />
        </Field>
        {fields.pointKind && (
          <Field label={t(POINT_LABELS[fields.pointKind].origin)} error={errors.originPoint}>
            <input className={inputCls} value={leg.originPoint} onChange={(e) => set({ originPoint: e.target.value })} />
          </Field>
        )}
      </div>

      <div className={gridCls}>
        <Field label={t("destinationCountry")} error={errors.destinationCountry}>
          <Combobox
            value={leg.destinationCountry}
            onChange={(v) => set({ destinationCountry: v, destinationCity: "" })}
            options={countries}
            placeholder={t("selectCountry")}
          />
        </Field>
        <Field label={t("destinationCity")} error={errors.destinationCity}>
          <Combobox
            value={leg.destinationCity}
            onChange={(v) => set({ destinationCity: v })}
            options={citiesFor(leg.destinationCountry).map((c) => ({ value: c, label: c }))}
            creatable
          />
        </Field>
        {fields.pointKind && (
          <Field label={t(POINT_LABELS[fields.pointKind].destination)} error={errors.destinationPoint}>
            <input
              className={inputCls}
              value={leg.destinationPoint}
              onChange={(e) => set({ destinationPoint: e.target.value })}
            />
          </Field>
        )}
      </div>

      <div className={gridCls}>
        {fields.vehicle && (
          <>
            <Field label={t("vehicleType")} error={errors.vehicleType}>
              <Combobox
                value={leg.vehicleType}
                onChange={(v) => set({ vehicleType: v })}
                options={opt(VEHICLE_TYPES, (v) => tv(v))}
              />
            </Field>
            <Field label={t("numberOfTrucks")} error={errors.vehicleCount}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={leg.vehicleCount}
                onChange={(e) => set({ vehicleCount: e.target.value })}
              />
            </Field>
          </>
        )}
        {fields.containers && (
          <>
            <Field label={t("containerType")} error={errors.containerType}>
              <Combobox
                value={leg.containerType}
                onChange={(v) => set({ containerType: v })}
                options={opt(fields.containerOptions, (v) => tc(v))}
              />
            </Field>
            <Field label={t("containerQuantity")} error={errors.containerCount}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={leg.containerCount}
                onChange={(e) => set({ containerCount: e.target.value })}
              />
            </Field>
          </>
        )}
        {fields.wagons && (
          <>
            <Field label={t("wagonType")} error={errors.wagonType}>
              <Combobox
                value={leg.wagonType}
                onChange={(v) => set({ wagonType: v })}
                options={opt(WAGON_TYPES, (v) => tw(v))}
              />
            </Field>
            <Field label={t("numberOfWagons")} error={errors.wagonCount}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={leg.wagonCount}
                onChange={(e) => set({ wagonCount: e.target.value })}
              />
            </Field>
          </>
        )}
        {fields.equipment && (
          <>
            <Field label={t("equipmentDescription")} error={errors.equipmentDescription} className="sm:col-span-2">
              <input
                className={inputCls}
                value={leg.equipmentDescription}
                onChange={(e) => set({ equipmentDescription: e.target.value })}
              />
            </Field>
            <Field label={t("equipmentQuantity")} error={errors.equipmentCount}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={leg.equipmentCount}
                onChange={(e) => set({ equipmentCount: e.target.value })}
              />
            </Field>
          </>
        )}
        {fields.air && (
          <>
            <Field label={t("chargeableWeight")} error={errors.chargeableWeightKg}>
              <input
                className={inputCls}
                placeholder={t("titleAuto")}
                value={leg.chargeableWeightKg}
                onChange={(e) => {
                  setCwTouched(true);
                  set({ chargeableWeightKg: e.target.value });
                }}
              />
            </Field>
            <Field label={t("volumetricDivisor")} error={errors.volumetricDivisor}>
              <input
                type="number"
                className={inputCls}
                value={leg.volumetricDivisor}
                onChange={(e) => set({ volumetricDivisor: e.target.value })}
              />
            </Field>
            <Field label={t("routingPreference")} error={errors.routingPreference}>
              <Combobox
                value={leg.routingPreference}
                onChange={(v) => set({ routingPreference: v })}
                options={opt(["direct", "transit", "none"], (v) => trp(v))}
              />
            </Field>
          </>
        )}
      </div>

      <Field label={t("notes")} error={errors.notes}>
        <input className={inputCls} value={leg.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </>
  );
}

/**
 * The route. A single-mode shipment renders one leg with no leg chrome — the
 * user never learns the word "leg" unless they choose multimodal, even though
 * the storage model is the same either way.
 */
export function LegEditor({
  family,
  legs,
  cargo,
  onChange,
  errors,
}: {
  family: string;
  legs: LegDraft[];
  /** Read-only here — the source for the air chargeable-weight autocalc. */
  cargo: CargoDraft;
  onChange: (next: LegDraft[]) => void;
  /** Flattened zod paths, e.g. `legs.0.subtype`. */
  errors: Record<string, string[]>;
}) {
  const t = useTranslations("fields");
  const tr = useTranslations("requests");
  const multimodal = family === "multimodal";

  const legErrors = (i: number): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    const prefix = `legs.${i}.`;
    for (const [key, value] of Object.entries(errors)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
  };

  const replace = (i: number, next: LegDraft) => onChange(legs.map((l, idx) => (idx === i ? next : l)));

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= legs.length) return;
    const next = [...legs];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  if (!family) return null;

  if (!multimodal) {
    const leg = legs[0];
    if (!leg) return null;
    return <LegBody leg={leg} cargo={cargo} onChange={(next) => replace(0, next)} errors={legErrors(0)} showTypePicker={false} />;
  }

  return (
    <div className="space-y-3">
      {legs.length === 0 && <p className="text-[13px] text-ink-soft">{tr("noLegs")}</p>}
      {/* Index keys: legs are reordered explicitly through `move`, which rewrites
          the whole array, and every input is controlled from the parent. */}
      {legs.map((leg, i) => (
        <div key={i} className="rounded-control border border-edge-soft bg-surface-hover p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11.5px] font-medium text-ink-soft">
              {t("leg")} {i + 1}
            </span>
            <div className="flex items-center gap-3 text-xs">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-brand hover:underline disabled:opacity-40 disabled:hover:no-underline">
                {t("moveUp")}
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === legs.length - 1} className="text-brand hover:underline disabled:opacity-40 disabled:hover:no-underline">
                {t("moveDown")}
              </button>
              <button type="button" onClick={() => onChange(legs.filter((_, idx) => idx !== i))} className="text-[rgb(var(--danger-fg))] hover:underline">
                {t("remove")}
              </button>
            </div>
          </div>
          <LegBody leg={leg} cargo={cargo} onChange={(next) => replace(i, next)} errors={legErrors(i)} showTypePicker />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...legs, emptyLeg()])}
        className="rounded-control border border-dashed border-edge-chip px-3 py-2 text-sm text-ink-soft hover:bg-surface-hover"
      >
        + {t("addLeg")}
      </button>
      {errors.legs && <p className="text-[11.5px] text-[rgb(var(--danger-fg))]">{errors.legs[0]}</p>}
    </div>
  );
}
