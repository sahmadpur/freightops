import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { transportModes, orders } from "@/db/schema";
import { leastAdvancedStatus, type OrderStatus } from "@/lib/order-status";

export type TransportListRow = {
  id: string;
  modeType: string;
  number: string;
  fromCountry: string | null;
  toCountry: string | null;
  route: string | null;
  loadingDate: string | null;
  plannedArrivalDate: string | null;
  totalWeightKg: string | null;
  totalVolumeM3: string | null;
  derivedStatus: OrderStatus | null;
  orderCount: number;
  ourWeightKg: number;
  ourVolumeM3: number;
  revenue: number;
  carrierCost: number;
  profit: number;
};

function num(v: string | null): number {
  return v ? Number(v) : 0;
}

export async function listTransportModes(): Promise<TransportListRow[]> {
  const modes = await db.select().from(transportModes).orderBy(desc(transportModes.createdAt));
  if (modes.length === 0) return [];

  const ids = modes.map((m) => m.id);
  const orderRows = await db
    .select({
      transportModeId: orders.transportModeId,
      status: orders.status,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      clientCharge: orders.clientCharge,
      carrierCost: orders.carrierCost,
    })
    .from(orders)
    .where(inArray(orders.transportModeId, ids));

  const byMode = new Map<string, typeof orderRows>();
  for (const o of orderRows) {
    if (!o.transportModeId) continue;
    const list = byMode.get(o.transportModeId) ?? [];
    list.push(o);
    byMode.set(o.transportModeId, list);
  }

  return modes.map((m) => {
    const os = byMode.get(m.id) ?? [];
    const statuses = os.map((o) => o.status as OrderStatus);
    const revenue = os.reduce((s, o) => s + num(o.clientCharge), 0);
    const carrierCost = os.reduce((s, o) => s + num(o.carrierCost), 0);
    return {
      id: m.id,
      modeType: m.modeType,
      number: m.number,
      fromCountry: m.fromCountry,
      toCountry: m.toCountry,
      route: m.route,
      loadingDate: m.loadingDate,
      plannedArrivalDate: m.plannedArrivalDate,
      totalWeightKg: m.totalWeightKg,
      totalVolumeM3: m.totalVolumeM3,
      derivedStatus: leastAdvancedStatus(statuses),
      orderCount: os.length,
      ourWeightKg: os.reduce((s, o) => s + num(o.weightKg), 0),
      ourVolumeM3: os.reduce((s, o) => s + num(o.volumeM3), 0),
      revenue,
      carrierCost,
      profit: revenue - carrierCost,
    };
  });
}

export async function getTransportMode(id: string) {
  const mode = await db.query.transportModes.findFirst({ where: eq(transportModes.id, id) });
  if (!mode) return null;
  const modeOrders = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      status: orders.status,
      accountId: orders.accountId,
    })
    .from(orders)
    .where(eq(orders.transportModeId, id))
    .orderBy(desc(orders.createdAt));
  return { mode, orders: modeOrders };
}

/** Lightweight list for the order form's "attach existing transport" dropdown. */
export async function transportModeOptions() {
  return db
    .select({ id: transportModes.id, number: transportModes.number, modeType: transportModes.modeType })
    .from(transportModes)
    .orderBy(desc(transportModes.createdAt))
    .limit(500);
}
