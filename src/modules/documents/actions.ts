"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { putObject, deleteObject } from "@/lib/s3";
import { buildS3Key, validateUpload } from "@/lib/upload";
import { uploadMetaSchema, visibilityInputSchema } from "./schema";
import type { ActionResult } from "@/lib/forms";

/** Upload a file (multipart FormData: `file` + metadata fields). */
export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const meta = uploadMetaSchema.safeParse({
    parentType: formData.get("parentType"),
    parentId: formData.get("parentId"),
    docType: formData.get("docType"),
    visibleToClient: formData.get("visibleToClient") ?? undefined,
  });
  if (!meta.success) return { ok: false, fieldErrors: meta.error.flatten().fieldErrors };

  const check = validateUpload({ name: file.name, type: file.type, size: file.size });
  if (!check.ok) return { ok: false, error: check.reason };

  const id = randomUUID();
  const key = buildS3Key(meta.data.parentType, meta.data.parentId, id, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Object first (we need the key persisted); roll it back if the DB write fails.
  await putObject(key, buffer, file.type || "application/octet-stream");

  try {
    await db.transaction(async (tx) => {
      await tx.insert(documents).values({
        id,
        parentType: meta.data.parentType,
        parentId: meta.data.parentId,
        fileName: file.name,
        docType: meta.data.docType,
        sizeBytes: file.size,
        s3Key: key,
        visibleToClient: meta.data.visibleToClient,
        createdBy: session.user.id,
      });
      await recordAudit(tx, {
        userId: session.user.id,
        entityType: meta.data.parentType,
        entityId: meta.data.parentId,
        action: "document_uploaded",
        changes: [{ field: "document", oldValue: null, newValue: file.name }],
      });
    });
  } catch (err) {
    await deleteObject(key).catch(() => {});
    throw err;
  }

  return { ok: true, id };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");

  const result = await db.transaction(async (tx) => {
    const doc = await tx.query.documents.findFirst({ where: eq(documents.id, documentId) });
    if (!doc) return "not_found" as const;
    await tx.delete(documents).where(eq(documents.id, documentId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: doc.parentType,
      entityId: doc.parentId,
      action: "document_removed",
      changes: [{ field: "document", oldValue: doc.fileName, newValue: null }],
    });
    return doc.s3Key;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  await deleteObject(result).catch(() => {});
  return { ok: true, id: documentId };
}

export async function setDocumentVisibility(documentId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = visibilityInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const result = await db.transaction(async (tx) => {
    const doc = await tx.query.documents.findFirst({ where: eq(documents.id, documentId) });
    if (!doc) return "not_found" as const;
    if (doc.visibleToClient === parsed.data.visibleToClient) return "ok" as const;
    await tx.update(documents).set({ visibleToClient: parsed.data.visibleToClient }).where(eq(documents.id, documentId));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: doc.parentType,
      entityId: doc.parentId,
      action: "document_visibility_changed",
      changes: [{ field: "visibleToClient", oldValue: String(doc.visibleToClient), newValue: String(parsed.data.visibleToClient) }],
    });
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: documentId };
}
