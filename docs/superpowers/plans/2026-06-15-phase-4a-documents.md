# FreightOps Phase 4a — Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add document storage: files stored in MinIO (S3) via the app server, uploaded/downloaded/deleted on orders and transport modes with a type tag and a client-visible flag, surfaced in an order Documents tab and a global Documents page (grouped by order, with search + type filter).

**Architecture:** Files are **proxied through the Next.js app** (not presigned-URL direct-to-MinIO). Upload is a server action receiving FormData; download is an authenticated route handler that streams from MinIO. This enforces the `visible_to_client` authorization gate on every download and avoids the MinIO presigned-URL host-mismatch in the dockerized setup (browser reaches `localhost:9000`, the app reaches `minio:9000`). The `documents` table already exists (Phase 1) — no migration. A `finance`-style feature module under `src/modules/documents/` holds schema + queries + actions; an S3 client wrapper lives in `src/lib/s3.ts`.

**Tech Stack:** Existing stack — Next.js 16 (App Router, server actions + route handlers), Drizzle + Postgres, Better Auth (`requireArea`), next-intl, Vitest, Tailwind v4 — plus `@aws-sdk/client-s3` for MinIO.

**Spec:** `docs/superpowers/specs/2026-06-12-freightops-platform-design.md` (module 7 "documents"), BRD §4.9. **Mock reference:** `docs/mock/freightops_mock.html` (Documents page cards, order Documents tab).

**Deliberate deviation from the spec:** the spec says "presigned-URL uploads/downloads (files bypass the app server)". This plan proxies through the app instead, because (a) a presigned GET would bypass the `visible_to_client` / role authorization check, and (b) presigned URLs embed the signing host, which breaks across the container-internal (`minio:9000`) vs browser (`localhost:9000`) split. Server-proxying enforces auth on every byte and works in dev and prod unchanged. File sizes here are modest (shipping docs/photos), so proxying is acceptable. Revisit presigning only if large-file throughput becomes a concern.

**Out of scope (Phase 4b / later):** order comment chat; email-notification outbox + SMTP; turning invitation links into emails; client-portal document visibility (the `visible_to_client` flag is set and stored now; clients consume it in Phase 5). Generating invoices/completion-act PDFs (mock buttons) — not in this phase. **Transport-mode document attachments (BRD §4.5):** the storage layer (schema, S3 keys, `uploadDocument`) already supports `parentType: "transport_mode"`, but no upload UI is added to the transport detail page in 4a — it's trivially added later by dropping a `DocumentsTab`-style section there with `parentType="transport_mode"`. The Documents page intentionally lists order documents only.

---

## Conventions (read first)

- **Dev:** `docker compose up -d` runs the app at `http://localhost:3000` (hot reload) with `postgres` + `minio`. MinIO API is reachable at `localhost:9000` (host) / `minio:9000` (containers); console at `localhost:9001` (login freightops / freightops_dev). One-off node scripts via `npx tsx --env-file=.env <file>.mts` (top-level await needs `.mts`). Tests/lint/tsc on the host.
- **iCloud hazard:** repo is under `~/Documents` (iCloud-synced). Before every gate: if `tsc` reports `.next/types/* 2.ts` errors, `rm -rf .next`; if source has `* 2.ext` siblings, delete: `find . \( -name "* 2" -o -name "* 2.*" \) -not -path './.git/*' -not -path './node_modules/*' -delete`.
- **S3 env (already wired):** `S3_ENDPOINT` (= `http://minio:9000` in the app-dev container), `S3_ACCESS_KEY` (freightops), `S3_SECRET_KEY` (freightops_dev), `S3_BUCKET` (freightops-documents) are present in `.env` and in the `app-dev`/`app` compose services. No new env needed.
- **Server-action security:** every `"use server"` function and the download route start with `await requireArea("staff")`.
- **Audit:** document upload/delete/visibility-change write `recordAudit(tx, …)` in the same `db.transaction` as the DB row change; `auditDiff` field lists contain only written columns (the Phase 2b lesson). NOTE: the S3 object PUT happens BEFORE the DB transaction (you need the key); if the DB insert fails, best-effort delete the orphaned object (documented in the task).
- **Client/server boundary (Phase 2b lesson):** a `"use client"` component must `import type` (not value-import) from any module that imports `db` or the S3 client. Put shared non-component helpers in non-client modules.
- **Money/dates** unchanged from prior phases.
- **Existing schema (no migration):** `documents` table = id, parentType (documentParentEnum: "order" | "transport_mode"), parentId, fileName, docType (docTypeEnum: cmr, awb, bill_of_lading, invoice, packing_list, certificate, waybill, cargo_photos, other; default "other"), sizeBytes (int), s3Key, visibleToClient (bool default false), createdAt, createdBy. Both enums are exported from `@/db/schema` with `.enumValues`.
- **Order detail tabs:** `src/modules/orders/order-detail-tabs.tsx` currently takes `{info, finance, history}`. This phase extends it to `{info, finance, documents, history}` (Documents tab inserted before History).
- **Test users:** admin@freightops.local / admin12345, op1@freightops.local / operatortest123. Admin cookie for curl:

```bash
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"admin@freightops.local","password":"admin12345"}' | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)
```

- **Test data:** accounts "Verify Co", "Baku Steel MMC"; carriers "Verify Carrier Co", "Akın Logistics". No orders currently. Verification tasks create their own order(s) + documents and clean them up; the phase-close task tracks this.

## File map

```
src/lib/s3.ts                            S3/MinIO client + ensureBucket, putObject, getObject, deleteObject
src/lib/upload.ts                        pure file validation: allowed types, max size, safe key generation (+ test)
src/modules/documents/schema.ts          uploadInputSchema, visibilityInputSchema (+ test)
src/modules/documents/queries.ts         listOrderDocuments, getDocument, listDocumentsByOrder (Documents page)
src/modules/documents/actions.ts         uploadDocument (FormData), deleteDocument, setDocumentVisibility (audited)
src/app/api/documents/[id]/download/route.ts   authenticated streamed download
src/modules/documents/documents-tab.tsx  order Documents tab (upload form + list + toggle + delete + download)
src/modules/documents/document-row.tsx   one document row (client; visibility toggle + delete + download link)
src/modules/orders/order-detail-tabs.tsx (modify) add Documents tab
src/app/(staff)/orders/[id]/page.tsx     (modify) compute listOrderDocuments, pass <DocumentsTab/>
src/app/(staff)/documents/page.tsx       (replace) all documents grouped by order + search + type filter
messages/{en,ru,az}.json                 (modify) documents namespace + docType labels
package.json                             + @aws-sdk/client-s3
```

---

### Task 1: Install the S3 client and write the MinIO wrapper

**Files:**
- Modify: `package.json` (dependency)
- Create: `src/lib/s3.ts`

- [ ] **Step 1: Install the AWS S3 SDK**

```bash
npm install @aws-sdk/client-s3
```

- [ ] **Step 2: Write `src/lib/s3.ts`**

```ts
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;
const BUCKET = process.env.S3_BUCKET ?? "freightops-documents";

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error("S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY are required");
}

/** MinIO needs path-style addressing and a region placeholder. */
export const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

export const S3_BUCKET = BUCKET;

let bucketReady = false;

/** Create the bucket if it doesn't exist. Idempotent; cached after first success. */
export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch (err) {
      // Another concurrent request may have created it; re-head to confirm.
      await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      void err;
    }
  }
  bucketReady = true;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Fetch an object's bytes and content type for streaming back to the client. */
export async function getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  await ensureBucket();
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return { body: Buffer.from(bytes), contentType: res.ContentType ?? "application/octet-stream" };
}
```

- [ ] **Step 3: Verify the client connects to MinIO** (dev stack must be up)

Create a throwaway `s3check.mts` in the repo root, run `npx tsx --env-file=.env s3check.mts`, then delete it:

```ts
import { putObject, getObject, deleteObject, S3_BUCKET } from "./src/lib/s3";
const key = "selftest/hello.txt";
await putObject(key, Buffer.from("hello minio"), "text/plain");
const got = await getObject(key);
console.log("bucket:", S3_BUCKET, "roundtrip:", got.body.toString(), "type:", got.contentType);
await deleteObject(key);
console.log(got.body.toString() === "hello minio" ? "PASS" : "FAIL");
process.exit(got.body.toString() === "hello minio" ? 0 : 1);
```

Expected: `roundtrip: hello minio` and `PASS`. (This also exercises `ensureBucket` creating `freightops-documents` on first use.) Note: `.env`'s `S3_ENDPOINT` is `http://minio:9000`; when running the script ON THE HOST it won't resolve `minio`. Run the check INSIDE the app container instead: `docker compose exec app-dev npx tsx --env-file=.env s3check.mts` (the container resolves `minio`). Delete the script after.

- [ ] **Step 4: Verify typecheck and commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json src/lib/s3.ts
git commit -m "feat: add MinIO S3 client wrapper (ensureBucket, put/get/delete)"
```

---

### Task 2: File-validation helper (TDD)

**Files:**
- Create: `src/lib/upload.ts`, `src/lib/upload.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/upload.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, validateUpload, buildS3Key } from "./upload";

describe("validateUpload", () => {
  it("accepts a normal PDF under the size limit", () => {
    expect(validateUpload({ name: "cmr.pdf", type: "application/pdf", size: 1024 })).toEqual({ ok: true });
  });
  it("rejects an empty file", () => {
    expect(validateUpload({ name: "x.pdf", type: "application/pdf", size: 0 })).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects files over the size limit", () => {
    expect(validateUpload({ name: "big.pdf", type: "application/pdf", size: MAX_FILE_BYTES + 1 })).toEqual({ ok: false, reason: "too_large" });
  });
  it("rejects a disallowed content type", () => {
    expect(validateUpload({ name: "evil.exe", type: "application/x-msdownload", size: 10 })).toEqual({ ok: false, reason: "type" });
  });
  it("accepts common doc/image types", () => {
    for (const type of ["application/pdf", "image/png", "image/jpeg", "image/webp"]) {
      expect(validateUpload({ name: "f", type, size: 10 }).ok).toBe(true);
    }
  });
});

describe("buildS3Key", () => {
  it("namespaces by parent and keeps a sanitized file name", () => {
    const key = buildS3Key("order", "ord-1", "uuid-123", "My CMR (final).pdf");
    expect(key).toBe("order/ord-1/uuid-123-My-CMR-final.pdf");
  });
  it("strips any directory components (no path traversal) and preserves the extension", () => {
    expect(buildS3Key("transport_mode", "tm-9", "abc", "../../etc/passwd")).toBe("transport_mode/tm-9/abc-passwd");
    expect(buildS3Key("order", "o", "k", "weird name!!.PNG")).toBe("order/o/k-weird-name.PNG");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` → FAIL (`Cannot find module './upload'`)

- [ ] **Step 3: Implement `src/lib/upload.ts`**

```ts
/** 20 MB cap — generous for shipping docs and cargo photos. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
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
  const base = fileName.split(/[\\/]/).pop() ?? fileName; // drop any path
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "") : "";
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = ext ? `${id}-${stem}.${ext}` : `${id}-${stem}`;
  return `${parentType}/${parentId}/${name}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass. (Spot-trace: `"My CMR (final).pdf"` → stem `My-CMR-final`, ext `pdf` → `uuid-123-My-CMR-final.pdf`; `"../../etc/passwd"` → `split(/[\\/]/).pop()` drops the directories to `passwd`, no extension → `abc-passwd` — path traversal is neutralized.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload.ts src/lib/upload.test.ts
git commit -m "feat: add file-upload validation and safe S3 key builder"
```

---

### Task 3: i18n — documents namespace + docType labels

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`, `messages/az.json`

- [ ] **Step 1: Add the `documents` and `docType` namespaces to all three catalogs** (merge nothing into existing namespaces; these are new top-level keys). Read each file first.

`messages/en.json`:

```json
{
  "documents": {
    "title": "Documents",
    "tab": "Documents",
    "upload": "Upload document",
    "uploading": "Uploading...",
    "fileLabel": "File",
    "typeLabel": "Document type",
    "visibleToClient": "Visible to client",
    "clientVisible": "Client visible",
    "internal": "Internal",
    "download": "Download",
    "remove": "Remove",
    "noDocuments": "No documents yet",
    "empty": "No documents have been uploaded yet.",
    "searchPlaceholder": "Search by file name, order #, client...",
    "allTypes": "All document types",
    "tooLarge": "File is too large (max 20 MB)",
    "badType": "That file type is not allowed",
    "emptyFile": "The file is empty",
    "uploadFailed": "Upload failed"
  },
  "docType": {
    "cmr": "CMR",
    "awb": "AWB",
    "bill_of_lading": "Bill of lading",
    "invoice": "Invoice",
    "packing_list": "Packing list",
    "certificate": "Certificate",
    "waybill": "Waybill",
    "cargo_photos": "Cargo photos",
    "other": "Other"
  }
}
```

`messages/ru.json`:

```json
{
  "documents": {
    "title": "Документы",
    "tab": "Документы",
    "upload": "Загрузить документ",
    "uploading": "Загрузка...",
    "fileLabel": "Файл",
    "typeLabel": "Тип документа",
    "visibleToClient": "Виден клиенту",
    "clientVisible": "Виден клиенту",
    "internal": "Внутренний",
    "download": "Скачать",
    "remove": "Удалить",
    "noDocuments": "Документов пока нет",
    "empty": "Документы ещё не загружены.",
    "searchPlaceholder": "Поиск по имени файла, № заказа, клиенту...",
    "allTypes": "Все типы документов",
    "tooLarge": "Файл слишком большой (макс. 20 МБ)",
    "badType": "Этот тип файла не разрешён",
    "emptyFile": "Файл пустой",
    "uploadFailed": "Не удалось загрузить"
  },
  "docType": {
    "cmr": "CMR",
    "awb": "AWB",
    "bill_of_lading": "Коносамент",
    "invoice": "Счёт",
    "packing_list": "Упаковочный лист",
    "certificate": "Сертификат",
    "waybill": "Накладная",
    "cargo_photos": "Фото груза",
    "other": "Прочее"
  }
}
```

`messages/az.json`:

```json
{
  "documents": {
    "title": "Sənədlər",
    "tab": "Sənədlər",
    "upload": "Sənəd yüklə",
    "uploading": "Yüklənir...",
    "fileLabel": "Fayl",
    "typeLabel": "Sənəd növü",
    "visibleToClient": "Müştəriyə görünür",
    "clientVisible": "Müştəriyə görünür",
    "internal": "Daxili",
    "download": "Yüklə",
    "remove": "Sil",
    "noDocuments": "Hələ sənəd yoxdur",
    "empty": "Hələ heç bir sənəd yüklənməyib.",
    "searchPlaceholder": "Fayl adı, sifariş №, müştəri ilə axtar...",
    "allTypes": "Bütün sənəd növləri",
    "tooLarge": "Fayl çox böyükdür (maks. 20 MB)",
    "badType": "Bu fayl növünə icazə verilmir",
    "emptyFile": "Fayl boşdur",
    "uploadFailed": "Yükləmə alınmadı"
  },
  "docType": {
    "cmr": "CMR",
    "awb": "AWB",
    "bill_of_lading": "Konosament",
    "invoice": "Qaimə",
    "packing_list": "Qablaşdırma siyahısı",
    "certificate": "Sertifikat",
    "waybill": "Yük qaiməsi",
    "cargo_photos": "Yük şəkilləri",
    "other": "Digər"
  }
}
```

- [ ] **Step 2: Verify key parity**

```bash
for f in en ru az; do python3 -c "
import json
d=json.load(open('messages/$f.json'))
def paths(o,p=''):
  for k,v in o.items():
    yield from (paths(v,p+'.'+k) if isinstance(v,dict) else [p+'.'+k])
print('$f', len(sorted(paths(d))))
"; done
```

Expected: identical counts across en/ru/az. Then `npm run build` → clean.

- [ ] **Step 3: Commit**

```bash
git add messages
git commit -m "feat: add documents/docType i18n keys for en, ru, az"
```

---

### Task 4: Documents schema (TDD)

**Files:**
- Create: `src/modules/documents/schema.ts`, `src/modules/documents/schema.test.ts`

- [ ] **Step 1: Write the failing test `src/modules/documents/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { uploadMetaSchema, visibilityInputSchema } from "./schema";

describe("uploadMetaSchema", () => {
  it("accepts valid upload metadata", () => {
    const r = uploadMetaSchema.safeParse({ parentType: "order", parentId: "ord-1", docType: "cmr", visibleToClient: "true" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibleToClient).toBe(true);
  });
  it("coerces the visibleToClient checkbox value", () => {
    const off = uploadMetaSchema.safeParse({ parentType: "order", parentId: "ord-1", docType: "other", visibleToClient: "false" });
    expect(off.success && off.data.visibleToClient).toBe(false);
    const missing = uploadMetaSchema.safeParse({ parentType: "order", parentId: "ord-1", docType: "other" });
    expect(missing.success && missing.data.visibleToClient).toBe(false);
  });
  it("rejects unknown parentType or docType", () => {
    expect(uploadMetaSchema.safeParse({ parentType: "spaceship", parentId: "x", docType: "cmr" }).success).toBe(false);
    expect(uploadMetaSchema.safeParse({ parentType: "order", parentId: "x", docType: "nope" }).success).toBe(false);
  });
  it("requires a non-empty parentId", () => {
    expect(uploadMetaSchema.safeParse({ parentType: "order", parentId: "", docType: "cmr" }).success).toBe(false);
  });
});

describe("visibilityInputSchema", () => {
  it("parses a boolean", () => {
    expect(visibilityInputSchema.safeParse({ visibleToClient: true }).success).toBe(true);
    expect(visibilityInputSchema.safeParse({ visibleToClient: "yes" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` → FAIL (module not found)

- [ ] **Step 3: Implement `src/modules/documents/schema.ts`**

```ts
import { z } from "zod";
import { documentParentEnum, docTypeEnum } from "@/db/schema";

/** Checkbox/string → boolean ("true" or "on" → true, everything else → false). */
const checkboxBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true" || v === "on");

export const uploadMetaSchema = z.object({
  parentType: z.enum(documentParentEnum.enumValues),
  parentId: z.string().trim().min(1),
  docType: z.enum(docTypeEnum.enumValues),
  visibleToClient: checkboxBool,
});

export type UploadMeta = z.infer<typeof uploadMetaSchema>;

export const visibilityInputSchema = z.object({
  visibleToClient: z.boolean(),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → all pass. (If `z.enum(enumValues)` rejects the readonly tuple, the Phase 2/3 modules used it without a cast on `modeTypeEnum`/`paymentDirectionEnum`, so it should be fine; if not, cast `as unknown as [string, ...string[]]`.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/documents/schema.ts src/modules/documents/schema.test.ts
git commit -m "feat: add documents schemas — upload metadata and visibility"
```

---

### Task 5: Documents queries

**Files:**
- Create: `src/modules/documents/queries.ts`

- [ ] **Step 1: Implement `src/modules/documents/queries.ts`**

```ts
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, orders, accounts } from "@/db/schema";

export type DocumentRow = {
  id: string;
  fileName: string;
  docType: string;
  sizeBytes: number | null;
  visibleToClient: boolean;
  createdAt: Date;
};

/** Documents attached to one order (Documents tab), newest first. */
export async function listOrderDocuments(orderId: string): Promise<DocumentRow[]> {
  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      docType: documents.docType,
      sizeBytes: documents.sizeBytes,
      visibleToClient: documents.visibleToClient,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(eq(documents.parentType, "order"), eq(documents.parentId, orderId)))
    .orderBy(desc(documents.createdAt));
  return rows;
}

/** One document's storage info (for the download route). Null if missing. */
export async function getDocument(id: string) {
  return db.query.documents.findFirst({ where: eq(documents.id, id) });
}

export type OrderDocumentGroup = {
  orderId: string;
  orderNumber: string;
  orderTitle: string;
  accountTitle: string;
  documents: DocumentRow[];
};

/**
 * All order-attached documents grouped by order (Documents page), with optional
 * free-text search (file name / order number / account title) and docType filter.
 * Transport-mode documents are not shown on this page (orders are the unit of work).
 */
export async function listDocumentsByOrder(opts: { q?: string; docType?: string }): Promise<OrderDocumentGroup[]> {
  const conds = [eq(documents.parentType, "order")];
  if (opts.docType) conds.push(eq(documents.docType, opts.docType as DocumentRow["docType"]));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(documents.fileName, like), ilike(orders.number, like), ilike(orders.title, like), ilike(accounts.title, like))!);
  }

  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      docType: documents.docType,
      sizeBytes: documents.sizeBytes,
      visibleToClient: documents.visibleToClient,
      createdAt: documents.createdAt,
      orderId: orders.id,
      orderNumber: orders.number,
      orderTitle: orders.title,
      accountTitle: accounts.title,
    })
    .from(documents)
    .innerJoin(orders, eq(documents.parentId, orders.id))
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt), desc(documents.createdAt));

  const groups = new Map<string, OrderDocumentGroup>();
  for (const r of rows) {
    let g = groups.get(r.orderId);
    if (!g) {
      g = { orderId: r.orderId, orderNumber: r.orderNumber, orderTitle: r.orderTitle, accountTitle: r.accountTitle, documents: [] };
      groups.set(r.orderId, g);
    }
    g.documents.push({
      id: r.id,
      fileName: r.fileName,
      docType: r.docType,
      sizeBytes: r.sizeBytes,
      visibleToClient: r.visibleToClient,
      createdAt: r.createdAt,
    });
  }
  return [...groups.values()];
}
```

Note: the `innerJoin(orders, eq(documents.parentId, orders.id))` is safe because the query is already filtered to `parentType = "order"`, so `parentId` is always an order id. The `or(...)!` non-null assertion is because drizzle's `or` returns `SQL | undefined`; it's never undefined here (we pass ≥2 args).

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint` clean. Then a query round-trip via temp `q5.mts` (run inside the container so it can reach the DB the same way; actually the DB is reachable from host at localhost:5432 so `npx tsx --env-file=.env q5.mts` on the host works — DATABASE_URL points at localhost). Delete after:

```ts
import { listOrderDocuments, listDocumentsByOrder, getDocument } from "./src/modules/documents/queries";
console.log("order docs:", (await listOrderDocuments("nope")).length);
console.log("grouped:", (await listDocumentsByOrder({})).length);
console.log("missing:", await getDocument("nope"));
process.exit(0);
```

Expected: `order docs: 0`, `grouped: 0`, `missing: undefined`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/documents/queries.ts
git commit -m "feat: documents queries — per-order list, grouped list with search, single lookup"
```

---

### Task 6: Documents actions (upload / delete / visibility, audited)

**Files:**
- Create: `src/modules/documents/actions.ts`

- [ ] **Step 1: Implement `src/modules/documents/actions.ts`**

```ts
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
    await deleteObject(key).catch(() => {}); // best-effort orphan cleanup
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
  // DB row gone; remove the object (best-effort — a leftover object is harmless).
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
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint` clean. (Full upload flow is exercised in the browser checklist in Task 10; the actions need a session so they can't run standalone.)

- [ ] **Step 3: Commit**

```bash
git add src/modules/documents/actions.ts
git commit -m "feat: documents actions — upload (S3 + audited), delete, visibility toggle"
```

---

### Task 7: Authenticated download route

**Files:**
- Create: `src/app/api/documents/[id]/download/route.ts`

- [ ] **Step 1: Implement the download route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireArea } from "@/lib/session";
import { getDocument } from "@/modules/documents/queries";
import { getObject } from "@/lib/s3";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Staff-only for now; Phase 5 will additionally allow a client to fetch their
  // own order's visible_to_client documents.
  await requireArea("staff");

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const { body, contentType } = await getObject(doc.s3Key);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      "Content-Length": String(body.length),
    },
  });
}
```

Note: `requireArea` redirects (throws) for unauthorized/unauthenticated requests — for a non-page route that yields a redirect response, which is acceptable (the browser follows it to /sign-in). The proxy (`src/proxy.ts`) does NOT exclude `/api/documents`, so unauthenticated requests are already bounced to /sign-in before reaching here; `requireArea` is defense-in-depth.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean. Runtime download is verified in Task 10 after an upload exists.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/documents/[id]/download/route.ts"
git commit -m "feat: authenticated document download route (streams from MinIO)"
```

---

### Task 8: Order Documents tab

**Files:**
- Create: `src/modules/documents/document-row.tsx`, `src/modules/documents/documents-tab.tsx`
- Modify: `src/modules/orders/order-detail-tabs.tsx`, `src/app/(staff)/orders/[id]/page.tsx`

- [ ] **Step 1: Create `src/modules/documents/document-row.tsx`** (client; one row with download link, visibility toggle, delete)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DocumentRow as DocRow } from "./queries";
import { deleteDocument, setDocumentVisibility } from "./actions";

export function DocumentRow({ doc }: { doc: DocRow }) {
  const t = useTranslations("documents");
  const td = useTranslations("docType");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleVisibility() {
    setBusy(true);
    const r = await setDocumentVisibility(doc.id, { visibleToClient: !doc.visibleToClient });
    setBusy(false);
    if (r.ok) router.refresh();
  }

  async function remove() {
    setBusy(true);
    const r = await deleteDocument(doc.id);
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <span className="flex-1 truncate">
        <span className="font-medium">{doc.fileName}</span>
        <span className="ml-2 text-xs text-slate-400">{td(doc.docType)}</span>
      </span>
      <button
        type="button"
        onClick={toggleVisibility}
        disabled={busy}
        className={`rounded-full px-2 py-0.5 text-[10.5px] ${doc.visibleToClient ? "bg-[#d4f2e7] text-[#085041]" : "bg-slate-200 text-slate-600"} disabled:opacity-50`}
      >
        {doc.visibleToClient ? t("clientVisible") : t("internal")}
      </button>
      <a href={`/api/documents/${doc.id}/download`} className="text-xs text-[#1a3a5c] hover:underline">
        {t("download")}
      </a>
      <button type="button" onClick={remove} disabled={busy} className="text-xs text-red-700 hover:underline disabled:opacity-50">
        {t("remove")}
      </button>
    </li>
  );
}
```

- [ ] **Step 2: Create `src/modules/documents/documents-tab.tsx`** (client; upload form + list)

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { inputCls } from "@/components/ui/form";
import type { DocumentRow as DocRow } from "./queries";
import { uploadDocument } from "./actions";
import { DocumentRow } from "./document-row";

const DOC_TYPES = ["cmr", "awb", "bill_of_lading", "invoice", "packing_list", "certificate", "waybill", "cargo_photos", "other"] as const;

export function DocumentsTab({ orderId, documents }: { orderId: string; documents: DocRow[] }) {
  const t = useTranslations("documents");
  const td = useTranslations("docType");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>("other");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("parentType", "order");
    fd.set("parentId", orderId);
    fd.set("docType", docType);
    fd.set("visibleToClient", visible ? "true" : "false");
    const r = await uploadDocument(fd);
    setPending(false);
    if (r.ok) {
      if (fileRef.current) fileRef.current.value = "";
      setVisible(false);
      setDocType("other");
      router.refresh();
    } else {
      const reason = r.error;
      setError(
        reason === "too_large" ? t("tooLarge") :
        reason === "type" ? t("badType") :
        reason === "empty" ? t("emptyFile") : t("uploadFailed"),
      );
    }
  }

  return (
    <Card>
      <CardHeader><span className="text-sm font-semibold">{t("tab")}</span></CardHeader>
      <CardBody>
        {documents.length === 0 ? (
          <p className="mb-4 text-sm text-slate-400">{t("noDocuments")}</p>
        ) : (
          <ul className="mb-4 space-y-1.5">
            {documents.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        )}

        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="file">{t("fileLabel")}</label>
            <input id="file" ref={fileRef} type="file" required className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="docType">{t("typeLabel")}</label>
            <select id="docType" className={`${inputCls} w-44`} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((d) => (<option key={d} value={d}>{td(d)}</option>))}
            </select>
          </div>
          <label className="mb-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            {t("visibleToClient")}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mb-1 rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? t("uploading") : t("upload")}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 3: Extend `src/modules/orders/order-detail-tabs.tsx`** to a Documents tab (read the current file; replace ENTIRELY with this 4-tab version)

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function OrderDetailTabs({
  info,
  finance,
  documents,
  history,
}: {
  info: React.ReactNode;
  finance: React.ReactNode;
  documents: React.ReactNode;
  history: React.ReactNode;
}) {
  const t = useTranslations("orders");
  const tf = useTranslations("finance");
  const tdoc = useTranslations("documents");
  const [tab, setTab] = useState<"info" | "finance" | "documents" | "history">("info");

  const tabCls = (active: boolean) =>
    `px-3.5 py-2 text-sm border-b-2 -mb-px ${active ? "border-[#1a3a5c] font-semibold text-[#1a3a5c]" : "border-transparent text-slate-500"}`;

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button type="button" className={tabCls(tab === "info")} onClick={() => setTab("info")}>{t("tabInfo")}</button>
        <button type="button" className={tabCls(tab === "finance")} onClick={() => setTab("finance")}>{tf("tab")}</button>
        <button type="button" className={tabCls(tab === "documents")} onClick={() => setTab("documents")}>{tdoc("tab")}</button>
        <button type="button" className={tabCls(tab === "history")} onClick={() => setTab("history")}>{t("tabHistory")}</button>
      </div>
      {tab === "info" ? info : tab === "finance" ? finance : tab === "documents" ? documents : history}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `src/app/(staff)/orders/[id]/page.tsx`** — read the file. Add imports:

```tsx
import { listOrderDocuments } from "@/modules/documents/queries";
import { DocumentsTab } from "@/modules/documents/documents-tab";
```

After the existing `const finance = await orderFinance(id);` line add:

```tsx
  const orderDocuments = await listOrderDocuments(id);
```

Change the `<OrderDetailTabs ... />` call to include the documents node:

```tsx
      <OrderDetailTabs
        info={info}
        finance={finance ? <FinanceTab orderId={order.id} finance={finance} /> : null}
        documents={<DocumentsTab orderId={order.id} documents={orderDocuments} />}
        history={historyNode}
      />
```

- [ ] **Step 5: Verify**

```bash
rm -rf .next
npx tsc --noEmit && npm test && npm run lint && npm run build
```

All clean (existing tests still pass; this task adds no unit tests — the upload flow is browser-verified in Task 10). The detail page renders for an order: create a quick order via temp `mk.mts` (insert order, capture id, delete after) then `curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE" "http://localhost:3000/orders/<id>"` → 200.

- [ ] **Step 6: Commit**

```bash
git add src/modules/documents/document-row.tsx src/modules/documents/documents-tab.tsx src/modules/orders/order-detail-tabs.tsx "src/app/(staff)/orders/[id]/page.tsx"
git commit -m "feat: order Documents tab — upload, list, client-visibility toggle, delete, download"
```

---

### Task 9: Documents page (grouped by order, search + type filter)

**Files:**
- Modify: `src/app/(staff)/documents/page.tsx` (replace placeholder)

- [ ] **Step 1: Replace `src/app/(staff)/documents/page.tsx`**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { inputCls } from "@/components/ui/form";
import { listDocumentsByOrder } from "@/modules/documents/queries";
import { docTypeEnum } from "@/db/schema";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const type = sp.type || undefined;
  const t = await getTranslations();
  const groups = await listDocumentsByOrder({ q, docType: type });

  return (
    <div>
      <PageHeader title={t("documents.title")} />
      <form className="mb-4 flex flex-wrap gap-2" action="/documents">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("documents.searchPlaceholder")}
          className={`${inputCls} w-80`}
        />
        <select name="type" defaultValue={type ?? ""} className={`${inputCls} w-52`}>
          <option value="">{t("documents.allTypes")}</option>
          {docTypeEnum.enumValues.map((d) => (
            <option key={d} value={d}>{t(`docType.${d}`)}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {t("common.search")}
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-400">{t("documents.empty")}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.orderId}>
              <CardHeader>
                <Link href={`/orders/${g.orderId}`} className="text-sm font-semibold text-[#1a3a5c] hover:underline">
                  {g.orderNumber} · {g.orderTitle}
                </Link>
                <span className="text-xs text-slate-400">{g.accountTitle}</span>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5">
                  {g.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 truncate">
                        <span className="font-medium">{d.fileName}</span>
                        <span className="ml-2 text-xs text-slate-400">{t(`docType.${d.docType}`)}</span>
                      </span>
                      {d.visibleToClient ? (
                        <span className="rounded-full bg-[#d4f2e7] px-2 py-0.5 text-[10.5px] text-[#085041]">{t("documents.clientVisible")}</span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10.5px] text-slate-600">{t("documents.internal")}</span>
                      )}
                      <a href={`/api/documents/${d.id}/download`} className="text-xs text-[#1a3a5c] hover:underline">
                        {t("documents.download")}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

(Confirm `common.search` exists in the catalogs — it was added in Phase 1. If it doesn't, use `documents.upload`'s sibling or add a `common.search` key; it should already be present.)

- [ ] **Step 2: Verify** — `rm -rf .next && npx tsc --noEmit && npm run lint && npm run build` clean. With the admin cookie: `curl -s -H "Cookie: $COOKIE" http://localhost:3000/documents | grep -c "All document types"` → ≥1; unauthenticated → 307.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(staff)/documents/page.tsx"
git commit -m "feat: documents page — all order documents grouped, with search and type filter"
```

---

### Task 10: Phase close — full verification and browser checklist

- [ ] **Step 1: Full gate**

```bash
rm -rf .next
npx tsc --noEmit && npm run lint && npm test && npm run build
npx tsx --env-file=.env scripts/check-schema.mts
```

Expected: all clean; schema line shows 15 tables. Test count ≥ 70 + new (upload validation ~6, documents schema ~5) ≈ 81+.

- [ ] **Step 2: Browser checklist** (Playwright against http://localhost:3000, admin@freightops.local / admin12345). Prepare a tiny test file on the host first: `printf 'CMR test content' > /tmp/cmr-test.pdf`.

1. Sign in. Create an order (Orders → New order): title "Docs demo", account "Baku Steel MMC". Save → order detail.
2. Click the **Documents** tab. EXPECT: "No documents yet" + an upload form (file input, document-type select, "Visible to client" checkbox, Upload button).
3. Upload `/tmp/cmr-test.pdf`: choose document type "CMR", leave visibility unchecked, click Upload. EXPECT: the file appears in the list with type "CMR" and an "Internal" badge; "No documents yet" is gone.
4. Click the file's visibility badge ("Internal"). EXPECT: it flips to "Client visible" (green).
5. Click **Download** on the row. EXPECT: a download is triggered (the browser fetches `/api/documents/<id>/download`; verify the response is 200 with the file — in Playwright, check the download event or navigate and confirm no error). Alternatively confirm via curl in step 3 of terminal checks.
6. Upload a second file as a different type ("Invoice"), visible checked. EXPECT: two rows now.
7. Remove the first document (Remove link). EXPECT: it disappears; one row remains.
8. Go to **Documents** (nav). EXPECT: a card for "Docs demo" order listing the remaining document(s) with type + visibility badge + Download. Use the type filter (select "Invoice") and submit → only invoice docs show. Clear and search the file name → matches.
9. Switch language to RU → Documents/тип labels translate (Документы, Счёт, Виден клиенту); back to EN.
10. Close the browser.

- [ ] **Step 3: Download + storage checks (terminal)**

Get the uploaded document id from the DB and curl the download with auth:

```bash
DOCID=$(docker compose exec -T postgres psql -U freightops -tA -c "select id from documents limit 1;")
curl -s -o /tmp/dl.out -w "download: %{http_code} %{size_download} bytes\n" -H "Cookie: $COOKIE" "http://localhost:3000/api/documents/$DOCID/download"
head -c 40 /tmp/dl.out; echo
# Unauthenticated download must NOT serve the file:
curl -s -o /dev/null -w "unauth download: %{http_code}\n" "http://localhost:3000/api/documents/$DOCID/download"
```
EXPECT: `download: 200 <n> bytes` with the file content; unauthenticated → 307 (bounced to /sign-in), NOT 200.

Confirm the object exists in MinIO and the audit log recorded the operations:
```bash
docker compose exec postgres psql -U freightops -c "select action, field, old_value, new_value from audit_log where action like 'document%' order by created_at;"
```
EXPECT: document_uploaded (×2), document_visibility_changed, document_removed rows.

Operator access:
```bash
OP=$(curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"op1@freightops.local","password":"operatortest123"}' | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | paste -sd'; ' -)
curl -s -o /dev/null -w "operator /documents: %{http_code}\n" -H "Cookie: $OP" http://localhost:3000/documents
```
EXPECT: 200.

- [ ] **Step 4: Clean up phase test data**

```bash
rm -f s3check.mts q5.mts mk.mts /tmp/cmr-test.pdf /tmp/dl.out
# Remove uploaded objects from MinIO, then the rows
docker compose exec postgres psql -U freightops -tA -c "select s3_key from documents;" | while read -r k; do [ -n "$k" ] && docker compose exec -T minio sh -c "mc alias set local http://localhost:9000 freightops freightops_dev >/dev/null 2>&1; mc rm local/freightops-documents/$k >/dev/null 2>&1" || true; done
docker compose exec postgres psql -U freightops <<'SQL'
DELETE FROM audit_log WHERE entity_type IN ('order','transport_mode');
DELETE FROM documents;
DELETE FROM orders;
DELETE FROM order_counters;
SQL
find . \( -name "* 2" -o -name "* 2.*" \) -not -path "./.git/*" -not -path "./node_modules/*" -delete
git status --short
```
(If the `mc` cleanup in the minio container is unavailable, leaving a few orphan objects in the dev bucket is harmless — note it and move on. The DB rows are what matter.)

- [ ] **Step 5: Commit any leftover & close**

```bash
git add -A && git diff --cached --quiet && echo "nothing to commit" || git commit -m "chore: close phase 4a — documents verified"
```

---

## Phase 4a complete after this

Documents are done: MinIO-backed upload/download/delete proxied through the app (with auth on every download), a type tag and a client-visible flag, the order Documents tab, and the global Documents page. **Next: Phase 4b (Collaboration)** — the order comment chat (polling refresh), the notification outbox table + SMTP worker with retry, and turning invitation links into real emails (order-created → carrier + client; status-changed → client; new comment → other side). Then Phase 5 (client portal) makes `visible_to_client` documents and the chat reachable by client users, and adds a client download path to the route guarded here. Deferred extras: presigned direct-to-MinIO transfer for large files; invoice/completion-act PDF generation.
