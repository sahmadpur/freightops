"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transportModes } from "@/db/schema";
import { auditDiff, recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { transportModeInputSchema, type TransportModeInput } from "./schema";
import type { ActionResult } from "@/lib/forms";

const AUDITED_FIELDS = [
  "modeType", "number", "fromCountry", "toCountry", "route",
  "loadingDate", "plannedArrivalDate", "totalWeightKg", "totalVolumeM3",
];

function toRow(data: TransportModeInput) {
  return {
    modeType: data.modeType,
    number: data.number,
    fromCountry: data.fromCountry || null,
    toCountry: data.toCountry || null,
    route: data.route || null,
    loadingDate: data.loadingDate || null,
    plannedArrivalDate: data.plannedArrivalDate || null,
    totalWeightKg: data.totalWeightKg || null,
    totalVolumeM3: data.totalVolumeM3 || null,
  };
}

export async function createTransportMode(input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = transportModeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transportModes)
      .values({ ...toRow(parsed.data), createdBy: session.user.id })
      .returning({ id: transportModes.id });
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "transport_mode",
      entityId: row.id,
      action: "created",
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function updateTransportMode(id: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = transportModeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.transportModes.findFirst({ where: eq(transportModes.id, id) });
    if (!before) return "not_found" as const;
    const after = toRow(parsed.data);
    await tx.update(transportModes).set(after).where(eq(transportModes.id, id));
    const changes = auditDiff(before, after, AUDITED_FIELDS);
    if (changes.length > 0) {
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: "transport_mode",
        entityId: id,
        action: "updated",
        changes,
      });
    }
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id };
}
