/** 20 MB cap — generous for shipping docs and cargo photos. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
] as const;

export type UploadCheck =
  | { ok: true }
  | { ok: false; reason: "empty" | "too_large" | "type" };

export function validateUpload(file: { name: string; type: string; size: number }): UploadCheck {
  if (file.size <= 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "too_large" };
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) return { ok: false, reason: "type" };
  return { ok: true };
}

/**
 * Build a collision-free, path-traversal-safe object key:
 * `<parentType>/<parentId>/<id>-<sanitized base>.<ext>`.
 * Strips directories, collapses non-alphanumeric runs to single hyphens.
 */
export function buildS3Key(parentType: string, parentId: string, id: string, fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "") : "";
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = ext ? `${id}-${stem}.${ext}` : `${id}-${stem}`;
  return `${parentType}/${parentId}/${name}`;
}
