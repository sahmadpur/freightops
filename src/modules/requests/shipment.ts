import { and, asc, eq } from "drizzle-orm";
import { cargoDetails, transportLegs } from "@/db/schema";
import type { db } from "@/db";
import type { CargoInput, LegInput } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, "select">;
export type ShipmentParent = "request" | "order";

/** "" → null, so an untouched form field never becomes an empty string in the column. */
const t = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);
const n = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);
const i = (v: string | undefined) => (v && v.trim() !== "" ? Number(v) : null);

/**
 * Replace a shipment's legs with what the form submitted.
 *
 * Replace-all rather than the keyed upsert `contacts` needs: nothing references
 * a leg by id, and legs are reordered constantly, so matching them up would buy
 * nothing. `legNumber` is assigned from array position, which is what makes the
 * sequence contiguous after a reorder or a removal.
 */
export async function writeLegs(
  tx: Tx,
  parentType: ShipmentParent,
  parentId: string,
  legs: LegInput[],
): Promise<void> {
  await tx
    .delete(transportLegs)
    .where(and(eq(transportLegs.parentType, parentType), eq(transportLegs.parentId, parentId)));
  if (legs.length === 0) return;
  await tx.insert(transportLegs).values(
    legs.map((leg, idx) => ({
      parentType,
      parentId,
      legNumber: idx + 1,
      transportType: leg.transportType,
      subtype: (t(leg.subtype) ?? null) as (typeof transportLegs.$inferInsert)["subtype"],
      originCountry: t(leg.originCountry),
      originCity: t(leg.originCity),
      originPoint: t(leg.originPoint),
      destinationCountry: t(leg.destinationCountry),
      destinationCity: t(leg.destinationCity),
      destinationPoint: t(leg.destinationPoint),
      vehicleType: (t(leg.vehicleType) ?? null) as (typeof transportLegs.$inferInsert)["vehicleType"],
      vehicleCount: i(leg.vehicleCount),
      containerType: (t(leg.containerType) ?? null) as (typeof transportLegs.$inferInsert)["containerType"],
      containerCount: i(leg.containerCount),
      wagonType: (t(leg.wagonType) ?? null) as (typeof transportLegs.$inferInsert)["wagonType"],
      wagonCount: i(leg.wagonCount),
      equipmentDescription: t(leg.equipmentDescription),
      equipmentCount: i(leg.equipmentCount),
      chargeableWeightKg: n(leg.chargeableWeightKg),
      volumetricDivisor: i(leg.volumetricDivisor),
      routingPreference: (t(leg.routingPreference) ?? null) as (typeof transportLegs.$inferInsert)["routingPreference"],
      notes: t(leg.notes),
    })),
  );
}

/** Upsert the single cargo row. The unique index on (parent_type, parent_id) enforces "single". */
export async function writeCargo(
  tx: Tx,
  parentType: ShipmentParent,
  parentId: string,
  cargo: CargoInput,
): Promise<void> {
  const values = {
    description: t(cargo.description),
    hsCodes: cargo.hsCodes,
    packages: i(cargo.packages),
    grossWeightKg: n(cargo.grossWeightKg),
    volumeM3: n(cargo.volumeM3),
    dimensions: cargo.dimensions
      .filter((d) => d.lengthCm || d.widthCm || d.heightCm)
      .map((d) => ({
        lengthCm: Number(d.lengthCm || 0),
        widthCm: Number(d.widthCm || 0),
        heightCm: Number(d.heightCm || 0),
        quantity: Number(d.quantity || 1),
      })),
    cargoValue: n(cargo.cargoValue),
    cargoCurrency: t(cargo.cargoCurrency),
    stackable: (t(cargo.stackable) ?? null) as (typeof cargoDetails.$inferInsert)["stackable"],
    dangerousGoods: cargo.dangerousGoods,
    // Detail columns are cleared with their flag, so a toggled-off block cannot
    // leave stale DG or temperature data behind.
    dgClass: cargo.dangerousGoods ? t(cargo.dgClass) : null,
    unNumber: cargo.dangerousGoods ? t(cargo.unNumber) : null,
    dgNotes: cargo.dangerousGoods ? t(cargo.dgNotes) : null,
    temperatureControlled: cargo.temperatureControlled,
    tempMinC: cargo.temperatureControlled ? n(cargo.tempMinC) : null,
    tempMaxC: cargo.temperatureControlled ? n(cargo.tempMaxC) : null,
    oversized: cargo.oversized,
    oversizedNotes: cargo.oversized ? t(cargo.oversizedNotes) : null,
  };

  const [existing] = await tx
    .select({ id: cargoDetails.id })
    .from(cargoDetails)
    .where(and(eq(cargoDetails.parentType, parentType), eq(cargoDetails.parentId, parentId)))
    .limit(1);

  if (existing) {
    await tx.update(cargoDetails).set(values).where(eq(cargoDetails.id, existing.id));
  } else {
    await tx.insert(cargoDetails).values({ parentType, parentId, ...values });
  }
}

export type LegRow = typeof transportLegs.$inferSelect;
export type CargoRow = typeof cargoDetails.$inferSelect;

export async function readLegs(
  executor: Executor,
  parentType: ShipmentParent,
  parentId: string,
): Promise<LegRow[]> {
  return executor
    .select()
    .from(transportLegs)
    .where(and(eq(transportLegs.parentType, parentType), eq(transportLegs.parentId, parentId)))
    .orderBy(asc(transportLegs.legNumber));
}

export async function readCargo(
  executor: Executor,
  parentType: ShipmentParent,
  parentId: string,
): Promise<CargoRow | null> {
  const [row] = await executor
    .select()
    .from(cargoDetails)
    .where(and(eq(cargoDetails.parentType, parentType), eq(cargoDetails.parentId, parentId)))
    .limit(1);
  return row ?? null;
}

/** Remove a shipment's legs and cargo. No DB-level cascade exists — parents are polymorphic. */
export async function deleteShipment(
  tx: Tx,
  parentType: ShipmentParent,
  parentId: string,
): Promise<void> {
  await tx
    .delete(transportLegs)
    .where(and(eq(transportLegs.parentType, parentType), eq(transportLegs.parentId, parentId)));
  await tx
    .delete(cargoDetails)
    .where(and(eq(cargoDetails.parentType, parentType), eq(cargoDetails.parentId, parentId)));
}

/** Identity and parentage are re-established by the copy, so they never carry over. */
const ROW_KEYS = ["id", "parentType", "parentId", "createdAt", "updatedAt"] as const;
type RowKey = (typeof ROW_KEYS)[number];

/**
 * Everything except the row's own identity. Copying by exclusion rather than by
 * an explicit column list means a column added later comes along automatically,
 * which is what you want when the two sides are the same shape by definition.
 */
function payloadOf<T extends Record<string, unknown>>(row: T): Omit<T, RowKey> {
  const out = { ...row };
  for (const key of ROW_KEYS) delete out[key];
  return out;
}

/**
 * Copy legs and cargo from one shipment to another — how converting a request
 * to an order moves the transport data without re-entry (§14, §28). The source
 * keeps its own rows: the request stays readable after conversion.
 */
export async function copyShipment(
  tx: Tx,
  from: { parentType: ShipmentParent; parentId: string },
  to: { parentType: ShipmentParent; parentId: string },
): Promise<void> {
  const legs = await readLegs(tx, from.parentType, from.parentId);
  if (legs.length > 0) {
    await tx
      .insert(transportLegs)
      .values(legs.map((leg) => ({ ...payloadOf(leg), parentType: to.parentType, parentId: to.parentId })));
  }
  const cargo = await readCargo(tx, from.parentType, from.parentId);
  if (cargo) {
    await tx
      .insert(cargoDetails)
      .values({ ...payloadOf(cargo), parentType: to.parentType, parentId: to.parentId });
  }
}
