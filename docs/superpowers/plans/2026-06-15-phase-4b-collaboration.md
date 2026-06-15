# FreightOps Phase 4b — Collaboration (Comments + Email Notifications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-order comment threads (staff chat with polling) and a transactional email-notification outbox processed by a background worker over SMTP, firing on order-created, status-changed, new-comment, and invitation events.

**Architecture:** Comments reuse the existing `comments` table (no migration). A new `notifications` outbox table is written **inside the same transaction** as the action that triggers it (atomic enqueue), so emails are never lost if the action rolls back. A single in-process worker, started from `src/instrumentation.ts` on server boot, polls the outbox every 15s and sends via nodemailer with bounded retries (3 attempts → `failed`). Dev SMTP is captured by a Mailpit container (web UI on :8025). Email bodies are plain-text English for v1 (recipient locale is not tracked yet; localization deferred).

**Tech Stack:** Next.js 16 (App Router, Server Actions, `instrumentation.ts`), Drizzle ORM + Postgres 16 (drizzle-kit migrations), nodemailer, Mailpit (dev SMTP), next-intl, Vitest, Docker Compose.

---

## Context for the implementer (read before starting)

- **Project conventions (apply to every task):**
  - Every server-action mutation starts with `await requireArea("staff")` (from `@/lib/session`; returns `{ session }` with `session.user.id`, `session.user.email`, `session.user.name`).
  - Audit rows are written via `recordAudit(tx, { userId, entityType, entityId, action, changes? })` (from `@/lib/audit`) **inside** the same `db.transaction`. The first param is a `DbExecutor` (the `tx`).
  - Feature modules live in `src/modules/<entity>/`; pages under `src/app/(staff)/<entity>/` stay thin.
  - Shared `ActionResult` type lives in `src/lib/forms.ts`.
  - **Client/server boundary:** a `"use client"` component may only `import type` from a module that imports `db` (server-only). Value-import only server actions from client components.
  - Client mutation handlers wrap action calls in `try { ... } finally { setBusy(false) }` and call `router.refresh()` (alone, never after `router.push()`) on success.
  - Money/locale/etc. are out of scope here.
- **Schema helpers** (already imported in `src/db/schema/domain.ts`): `id()`, `createdAt()`, `updatedAt()`, `createdBy()`, plus drizzle `text`, `timestamp`, `integer`, `boolean`, `jsonb`, `index`, `pgEnum`, `pgTable`, `sql`.
- **Existing `comments` table** (`src/db/schema/domain.ts`) — DO NOT recreate:
  ```ts
  export const comments = pgTable("comments", {
    id: id(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => user.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  }, (t) => [index("comments_order_id_idx").on(t.orderId)]);
  ```
- **Schema index** `src/db/schema/index.ts` is `export * from "./domain"` — new tables/enums added to `domain.ts` are auto-exported.
- **Migrations:** add fields to `domain.ts`, then `npm run db:generate` (drizzle-kit) creates a numbered SQL file under `drizzle/`, and `npm run db:migrate` applies it. Both read `.env` `DATABASE_URL` (host Postgres on `localhost:5432`). The schema-shape check is `npx tsx --env-file=.env scripts/check-schema.mts` (expects **16 tables** after this phase: 15 existing + `notifications`).
- **i18n:** message catalogs are `messages/{en,ru,az}.json`; each currently has 202 keys and **must stay at parity**.
- **Docker:** `app-dev` (hot-reload dev) and `app` (prod, "full" profile) each have their own `node_modules` volume — a newly installed npm dep must also be installed in the running `app-dev` container (`docker compose exec app-dev npm install`) or it won't resolve at runtime.

---

## File Structure

**Create:**
- `src/lib/mailer.ts` — nodemailer transport + `sendMail()`
- `src/modules/notifications/enqueue.ts` — `enqueueNotification` / `enqueueMany` (in-tx outbox writes)
- `src/modules/notifications/templates.ts` — pure `EmailContent` builders per event
- `src/modules/notifications/templates.test.ts` — template unit tests
- `src/modules/notifications/recipients.ts` — `orderRecipients(tx, orderId)` → client/carrier emails
- `src/modules/notifications/worker.ts` — `startNotificationWorker()` poll loop
- `src/instrumentation.ts` — boots the worker on server start
- `src/modules/comments/schema.ts` — `commentInputSchema`
- `src/modules/comments/schema.test.ts` — validation tests
- `src/modules/comments/queries.ts` — `listOrderComments(orderId)`
- `src/modules/comments/actions.ts` — `addComment(orderId, input)` (audited + notifies)
- `src/modules/comments/comments-tab.tsx` — client chat tab (list + composer + polling)

**Modify:**
- `src/db/schema/domain.ts` — add `notificationStatusEnum` + `notifications` table
- `docker-compose.yml` — add `mailpit` service; SMTP env on `app-dev`/`app`
- `.env` and `.env.example` — `SMTP_*` vars
- `package.json` — `nodemailer` + `@types/nodemailer` deps
- `src/lib/audit.ts` — ensure `DbExecutor` is exported (add `export` if missing)
- `src/modules/orders/actions.ts` — enqueue on `createOrder` + `changeOrderStatus`
- `src/lib/invitations.ts` — wrap `createInvitation` in a tx + enqueue invitation email
- `src/modules/orders/order-detail-tabs.tsx` — add 5th "Comments" tab
- `src/app/(staff)/orders/[id]/page.tsx` — load comments + current user, pass to tabs
- `messages/{en,ru,az}.json` — add `comments` namespace

---

## Execution waves (for the controller)

Tasks touch disjoint files within a wave and may run as parallel subagents; respect the wave order (later waves import earlier waves' code).

- **Wave 1 (parallel):** T1 (notifications schema/migration), T2 (mailer + Mailpit + env + deps), T3 (comments schema + queries)
- **Wave 2 (parallel):** T4 (notifications module: enqueue/templates/recipients), T5 (worker + instrumentation)
- **Wave 3 (parallel):** T6 (comments actions), T7 (order + invitation enqueue wiring)
- **Wave 4:** T8 (comments tab UI + tab wiring + order page), T9 (i18n)
- **Wave 5:** T10 (browser verification + phase close)

---

## Task 1: Notifications outbox table + migration

**Files:**
- Modify: `src/db/schema/domain.ts`
- Generated: `drizzle/0002_*.sql`

- [ ] **Step 1: Add the enum and table to `domain.ts`**

Add near the other enums (after `documentParentEnum`):

```ts
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);
```

Add at the end of the table definitions:

```ts
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("notifications_status_idx").on(t.status)],
);
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0002_*.sql` creating `notification_status` enum + `notifications` table, and an updated `drizzle/meta` snapshot.

- [ ] **Step 3: Apply the migration**

Run: `npm run db:migrate`
Expected: applies cleanly; no error.

- [ ] **Step 4: Verify schema shape**

Run: `npx tsx --env-file=.env scripts/check-schema.mts`
Expected: reports **16 tables** including `notifications`, no missing/extra drift.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/domain.ts drizzle/
git commit -m "feat(notifications): add notifications outbox table + migration"
```

---

## Task 2: SMTP mailer + Mailpit dev container + env

**Files:**
- Create: `src/lib/mailer.ts`
- Modify: `docker-compose.yml`, `.env`, `.env.example`, `package.json`

- [ ] **Step 1: Install nodemailer**

Run: `npm install nodemailer && npm install -D @types/nodemailer`
Expected: both added to `package.json`.

- [ ] **Step 2: Write the mailer**

Create `src/lib/mailer.ts`:

```ts
import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transport;
}

/** Send one plain-text email. Throws on transport failure (the worker handles retry). */
export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<void> {
  await getTransport().sendMail({
    from: process.env.SMTP_FROM ?? "FreightOps <no-reply@freightops.local>",
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
  });
}
```

- [ ] **Step 3: Add the Mailpit service to `docker-compose.yml`**

Add a service alongside `postgres`/`minio`:

```yaml
  mailpit:
    image: axllent/mailpit:latest
    restart: unless-stopped
    ports:
      - "8025:8025"   # web UI
      - "1025:1025"   # SMTP
    environment:
      MP_MAX_MESSAGES: "500"
```

- [ ] **Step 4: Wire SMTP env into the app services**

In `docker-compose.yml`, add to the `environment:` block of BOTH `app-dev` and `app`:

```yaml
      SMTP_HOST: mailpit
      SMTP_PORT: "1025"
      SMTP_FROM: "FreightOps <no-reply@freightops.local>"
```

- [ ] **Step 5: Add SMTP vars to `.env` and `.env.example`**

Append to both files (in `.env.example` use placeholder/non-secret values):

```
# SMTP (dev: Mailpit). Host is "mailpit" inside Docker, "localhost" when running on the host.
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=FreightOps <no-reply@freightops.local>
# SMTP_SECURE=false
# SMTP_USER=
# SMTP_PASS=
```

- [ ] **Step 6: Install the dep inside the running dev container**

Run: `docker compose exec app-dev npm install` (no-op if `app-dev` isn't up; ensures nodemailer resolves at runtime).
Expected: no error.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/mailer.ts docker-compose.yml .env.example package.json package-lock.json
git commit -m "feat(notifications): nodemailer mailer + Mailpit dev SMTP"
```

(Note: `.env` is gitignored — do not commit it.)

---

## Task 3: Comment validation schema + query

**Files:**
- Create: `src/modules/comments/schema.ts`, `src/modules/comments/schema.test.ts`, `src/modules/comments/queries.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/comments/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { commentInputSchema } from "./schema";

describe("commentInputSchema", () => {
  it("accepts a non-empty trimmed body", () => {
    const r = commentInputSchema.safeParse({ body: "  hello team  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toBe("hello team");
  });
  it("rejects an empty/whitespace body", () => {
    expect(commentInputSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(commentInputSchema.safeParse({ body: "" }).success).toBe(false);
  });
  it("rejects an over-long body", () => {
    expect(commentInputSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/comments/schema.test.ts`
Expected: FAIL (module `./schema` not found).

- [ ] **Step 3: Write the schema**

Create `src/modules/comments/schema.ts`:

```ts
import { z } from "zod";

export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type CommentInput = z.infer<typeof commentInputSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/comments/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the query**

Create `src/modules/comments/queries.ts`:

```ts
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, user } from "@/db/schema";

export type CommentRow = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
};

/** All comments on one order, oldest first (chat order). */
export async function listOrderComments(orderId: string): Promise<CommentRow[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      authorId: comments.authorId,
      authorName: user.name,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(user, eq(comments.authorId, user.id))
    .where(eq(comments.orderId, orderId))
    .orderBy(asc(comments.createdAt));
  return rows;
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (If `user.name` is not a column, fall back to `user.email` and rename the selected field accordingly — verify against `src/db/schema/auth.ts`.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/comments/schema.ts src/modules/comments/schema.test.ts src/modules/comments/queries.ts
git commit -m "feat(comments): input schema + order comments query"
```

---

## Task 4: Notifications module — enqueue, templates, recipients

**Files:**
- Modify: `src/lib/audit.ts` (export `DbExecutor` if not already)
- Create: `src/modules/notifications/enqueue.ts`, `src/modules/notifications/templates.ts`, `src/modules/notifications/templates.test.ts`, `src/modules/notifications/recipients.ts`

- [ ] **Step 1: Ensure `DbExecutor` is exported from `audit.ts`**

Open `src/lib/audit.ts`. If the `DbExecutor` type is declared without `export`, add `export`. (It is the type of `recordAudit`'s first parameter — a db-or-transaction executor.)

- [ ] **Step 2: Write the failing template test**

Create `src/modules/notifications/templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  orderCreatedEmail,
  orderStatusChangedEmail,
  newCommentEmail,
  invitationEmail,
} from "./templates";

describe("email templates", () => {
  it("orderCreatedEmail includes number, title, and url", () => {
    const e = orderCreatedEmail({ orderNumber: "ORD-2026-001", orderTitle: "Steel coils", url: "http://x/orders/1" });
    expect(e.subject).toContain("ORD-2026-001");
    expect(e.body).toContain("Steel coils");
    expect(e.body).toContain("http://x/orders/1");
  });
  it("orderStatusChangedEmail includes the status", () => {
    const e = orderStatusChangedEmail({ orderNumber: "ORD-2026-001", status: "delivered", url: "http://x/orders/1" });
    expect(e.subject).toContain("ORD-2026-001");
    expect(e.body).toContain("delivered");
  });
  it("newCommentEmail includes author and preview", () => {
    const e = newCommentEmail({ orderNumber: "ORD-2026-001", authorName: "Aida", preview: "ready to ship", url: "http://x/orders/1" });
    expect(e.body).toContain("Aida");
    expect(e.body).toContain("ready to ship");
  });
  it("invitationEmail includes the url", () => {
    const e = invitationEmail({ url: "http://x/accept-invitation?token=abc", role: "operator" });
    expect(e.body).toContain("http://x/accept-invitation?token=abc");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/modules/notifications/templates.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the templates**

Create `src/modules/notifications/templates.ts`:

```ts
export type EmailContent = { subject: string; body: string };

// v1 emails are plain-text English. Recipient locale is not tracked yet; localize later.
export function orderCreatedEmail(d: { orderNumber: string; orderTitle: string; url: string }): EmailContent {
  return {
    subject: `New order ${d.orderNumber}: ${d.orderTitle}`,
    body:
      `A new order has been created.\n\n` +
      `Order: ${d.orderNumber}\nTitle: ${d.orderTitle}\n\n` +
      `View it here: ${d.url}\n`,
  };
}

export function orderStatusChangedEmail(d: { orderNumber: string; status: string; url: string }): EmailContent {
  return {
    subject: `Order ${d.orderNumber} status: ${d.status}`,
    body:
      `The status of order ${d.orderNumber} changed to "${d.status}".\n\n` +
      `View it here: ${d.url}\n`,
  };
}

export function newCommentEmail(d: { orderNumber: string; authorName: string; preview: string; url: string }): EmailContent {
  return {
    subject: `New comment on order ${d.orderNumber}`,
    body:
      `${d.authorName} commented on order ${d.orderNumber}:\n\n` +
      `"${d.preview}"\n\n` +
      `Reply here: ${d.url}\n`,
  };
}

export function invitationEmail(d: { url: string; role: string }): EmailContent {
  return {
    subject: `You have been invited to FreightOps`,
    body:
      `You have been invited to FreightOps as a ${d.role}.\n\n` +
      `Accept your invitation here: ${d.url}\n\n` +
      `This link expires in 7 days.\n`,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/modules/notifications/templates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the enqueue helpers**

Create `src/modules/notifications/enqueue.ts`:

```ts
import { notifications } from "@/db/schema";
import type { DbExecutor } from "@/lib/audit";
import type { EmailContent } from "./templates";

/** Insert one pending outbox row. MUST be called inside the triggering action's transaction. */
export async function enqueueNotification(
  tx: DbExecutor,
  n: { toEmail: string; subject: string; body: string; relatedType?: string; relatedId?: string },
): Promise<void> {
  await tx.insert(notifications).values({
    toEmail: n.toEmail,
    subject: n.subject,
    body: n.body,
    relatedType: n.relatedType ?? null,
    relatedId: n.relatedId ?? null,
  });
}

/** Enqueue the same content to many recipients (deduped, empty-safe). */
export async function enqueueMany(
  tx: DbExecutor,
  emails: string[],
  content: EmailContent,
  related?: { type?: string; id?: string },
): Promise<void> {
  const unique = [...new Set(emails.filter(Boolean))];
  for (const to of unique) {
    await enqueueNotification(tx, {
      toEmail: to,
      subject: content.subject,
      body: content.body,
      relatedType: related?.type,
      relatedId: related?.id,
    });
  }
}
```

- [ ] **Step 7: Write the recipients helper**

Create `src/modules/notifications/recipients.ts`:

```ts
import { eq, inArray } from "drizzle-orm";
import { contacts, orders } from "@/db/schema";
import type { DbExecutor } from "@/lib/audit";

export type OrderRecipients = { clientEmails: string[]; carrierEmails: string[] };

/** Collect notification emails for an order's account (client) and carrier contacts. */
export async function orderRecipients(tx: DbExecutor, orderId: string): Promise<OrderRecipients> {
  const [order] = await tx
    .select({ accountId: orders.accountId, carrierId: orders.carrierId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { clientEmails: [], carrierEmails: [] };

  const ids = [order.accountId, order.carrierId].filter((v): v is string => Boolean(v));
  const rows = await tx
    .select({ parentType: contacts.parentType, parentId: contacts.parentId, emails: contacts.emails })
    .from(contacts)
    .where(inArray(contacts.parentId, ids));

  const client = new Set<string>();
  const carrier = new Set<string>();
  for (const r of rows) {
    const bucket =
      r.parentType === "account" && r.parentId === order.accountId
        ? client
        : r.parentType === "carrier" && r.parentId === order.carrierId
          ? carrier
          : null;
    if (!bucket) continue;
    for (const e of r.emails ?? []) if (e) bucket.add(e);
  }
  return { clientEmails: [...client], carrierEmails: [...carrier] };
}
```

- [ ] **Step 8: Type-check + run tests**

Run: `npx tsc --noEmit && npx vitest run src/modules/notifications/templates.test.ts`
Expected: clean; 4 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/audit.ts src/modules/notifications/enqueue.ts src/modules/notifications/templates.ts src/modules/notifications/templates.test.ts src/modules/notifications/recipients.ts
git commit -m "feat(notifications): in-tx enqueue, email templates, order recipients"
```

---

## Task 5: Outbox worker + instrumentation boot

**Files:**
- Create: `src/modules/notifications/worker.ts`, `src/instrumentation.ts`

- [ ] **Step 1: Write the worker**

Create `src/modules/notifications/worker.ts`:

```ts
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { sendMail } from "@/lib/mailer";

const MAX_ATTEMPTS = 3;
const POLL_MS = 15_000;
const BATCH = 10;

let started = false;

async function tick(): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.status, "pending"), lt(notifications.attempts, MAX_ATTEMPTS)))
      .limit(BATCH);

    for (const n of pending) {
      try {
        await sendMail({ to: n.toEmail, subject: n.subject, text: n.body });
        await db
          .update(notifications)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(notifications.id, n.id));
      } catch (err) {
        const attempts = n.attempts + 1;
        await db
          .update(notifications)
          .set({
            attempts,
            status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
            lastError: err instanceof Error ? err.message : String(err),
          })
          .where(eq(notifications.id, n.id));
        console.error(`[notifications] send failed for ${n.id} (attempt ${attempts})`, err);
      }
    }
  } catch (err) {
    console.error("[notifications] worker tick failed", err);
  }
}

/** Idempotent: starts the single in-process poll loop. Safe to call once per server boot. */
export function startNotificationWorker(): void {
  if (started) return;
  started = true;
  const timer = setInterval(() => void tick(), POLL_MS);
  // Don't keep the process alive solely for the poller.
  if (typeof timer.unref === "function") timer.unref();
  console.log("[notifications] worker started");
}
```

- [ ] **Step 2: Write the instrumentation hook**

Create `src/instrumentation.ts`:

```ts
export async function register(): Promise<void> {
  // Only run the worker in the Node.js server runtime (not edge, not build).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NOTIFICATIONS_WORKER === "off") return;
  const { startNotificationWorker } = await import("@/modules/notifications/worker");
  startNotificationWorker();
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/modules/notifications/worker.ts src/instrumentation.ts
git commit -m "feat(notifications): outbox worker + instrumentation boot"
```

---

## Task 6: Comment server action (audited + notifies)

**Files:**
- Create: `src/modules/comments/actions.ts`

- [ ] **Step 1: Write the action**

Create `src/modules/comments/actions.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, orders } from "@/db/schema";
import { requireArea } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/forms";
import { commentInputSchema } from "./schema";
import { orderRecipients } from "@/modules/notifications/recipients";
import { enqueueMany } from "@/modules/notifications/enqueue";
import { newCommentEmail } from "@/modules/notifications/templates";

export async function addComment(orderId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const body = parsed.data.body;

  const result = await db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return "not_found" as const;

    const [row] = await tx
      .insert(comments)
      .values({ orderId, authorId: session.user.id, body })
      .returning({ id: comments.id });

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "order",
      entityId: orderId,
      action: "comment_added",
    });

    // Notify the client side of the thread (portal recipients land in Phase 5).
    const { clientEmails } = await orderRecipients(tx, orderId);
    if (clientEmails.length) {
      await enqueueMany(
        tx,
        clientEmails,
        newCommentEmail({
          orderNumber: order.number,
          authorName: session.user.name ?? session.user.email,
          preview: body.slice(0, 140),
          url: `${process.env.APP_BASE_URL}/orders/${orderId}`,
        }),
        { type: "order", id: orderId },
      );
    }

    return row.id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (Confirm `session.user.name`/`session.user.email` exist; if `name` is absent on the session type, use `session.user.email` alone.)

- [ ] **Step 3: Commit**

```bash
git add src/modules/comments/actions.ts
git commit -m "feat(comments): addComment action (audited, notifies client side)"
```

---

## Task 7: Wire enqueue into order + invitation triggers

**Files:**
- Modify: `src/modules/orders/actions.ts`, `src/lib/invitations.ts`

- [ ] **Step 1: Import helpers in `orders/actions.ts`**

Add to the imports at the top:

```ts
import { orderRecipients } from "@/modules/notifications/recipients";
import { enqueueMany } from "@/modules/notifications/enqueue";
import { orderCreatedEmail, orderStatusChangedEmail } from "@/modules/notifications/templates";
```

- [ ] **Step 2: Enqueue in `createOrder` (inside the tx, after `recordAudit(... action: "created")` and before `return row.id`)**

```ts
      const { clientEmails, carrierEmails } = await orderRecipients(tx, row.id);
      await enqueueMany(
        tx,
        [...clientEmails, ...carrierEmails],
        orderCreatedEmail({
          orderNumber: number,
          orderTitle: data.title,
          url: `${process.env.APP_BASE_URL}/orders/${row.id}`,
        }),
        { type: "order", id: row.id },
      );
```

(`number` and `data.title` are already in scope in `createOrder`.)

- [ ] **Step 3: Enqueue in `changeOrderStatus` (inside the tx, after the `recordAudit(... action: "status_changed")` call and before `return "ok"`)**

```ts
    const { clientEmails } = await orderRecipients(tx, id);
    await enqueueMany(
      tx,
      clientEmails,
      orderStatusChangedEmail({
        orderNumber: before.number,
        status,
        url: `${process.env.APP_BASE_URL}/orders/${id}`,
      }),
      { type: "order", id },
    );
```

(`before.number` and `status` are already in scope. Place AFTER the `if (before.status === status) return "ok"` short-circuit so unchanged saves don't email.)

- [ ] **Step 4: Wrap `createInvitation` in a transaction + enqueue (in `src/lib/invitations.ts`)**

Add imports:

```ts
import { enqueueNotification } from "@/modules/notifications/enqueue";
import { invitationEmail } from "@/modules/notifications/templates";
```

Replace the body of `createInvitation` (keep the signature and return shape):

```ts
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const url = `${process.env.APP_BASE_URL}/accept-invitation?token=${token}`;
  await db.transaction(async (tx) => {
    await tx.insert(invitations).values({
      email: params.email,
      role: params.role,
      accountId: params.accountId ?? null,
      token,
      expiresAt,
      invitedBy: params.invitedBy,
    });
    const content = invitationEmail({ url, role: params.role });
    await enqueueNotification(tx, {
      toEmail: params.email,
      subject: content.subject,
      body: content.body,
      relatedType: "invitation",
    });
  });
  return { token, url };
```

- [ ] **Step 5: Type-check + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: clean; all prior tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/orders/actions.ts src/lib/invitations.ts
git commit -m "feat(notifications): enqueue on order-created, status-changed, invitation"
```

---

## Task 8: Comments tab UI + tab wiring + order page

**Files:**
- Create: `src/modules/comments/comments-tab.tsx`
- Modify: `src/modules/orders/order-detail-tabs.tsx`, `src/app/(staff)/orders/[id]/page.tsx`

- [ ] **Step 1: Write the comments tab (client component)**

Create `src/modules/comments/comments-tab.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CommentRow } from "./queries";
import { addComment } from "./actions";

export function CommentsTab({
  orderId,
  comments,
  currentUserId,
}: {
  orderId: string;
  comments: CommentRow[];
  currentUserId: string;
}) {
  const t = useTranslations("comments");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Poll for new messages while the tab is open.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const r = await addComment(orderId, { body: text });
      if (r.ok) {
        setBody("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-sm text-slate-400">{t("empty")}</p>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {comments.map((c) => {
            const mine = c.authorId === currentUserId;
            return (
              <li key={c.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-[#1a3a5c] text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{c.body}</div>
                </div>
                <span className="mt-0.5 text-[11px] text-slate-400">
                  {c.authorName} · {new Date(c.createdAt).toLocaleString()}
                </span>
              </li>
            );
          })}
          <div ref={endRef} />
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder")}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#1a3a5c] focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || body.trim().length === 0}
          className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? t("sending") : t("send")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the Comments tab to `order-detail-tabs.tsx`**

This file currently renders 4 tabs (info, finance, documents, history) and takes those nodes as props. Add a `comments` tab:
- Add `comments: React.ReactNode` to the component's props.
- Add a 5th button after the history button:
  ```tsx
  <button type="button" className={tabCls(tab === "comments")} onClick={() => setTab("comments")}>{tc("tab")}</button>
  ```
  where `tc` is `useTranslations("comments")` (add `const tc = useTranslations("comments");` near the other `useTranslations` calls).
- Extend the render ternary to include comments:
  ```tsx
  {tab === "info" ? info : tab === "finance" ? finance : tab === "documents" ? documents : tab === "comments" ? comments : history}
  ```
- Add `"comments"` to the `tab` state union type.

- [ ] **Step 3: Load comments + current user in the order page**

In `src/app/(staff)/orders/[id]/page.tsx`:
- Import: `import { listOrderComments } from "@/modules/comments/queries";` and `import { CommentsTab } from "@/modules/comments/comments-tab";`
- Ensure the current user id is available. The page already resolves the order; add (or reuse) a session lookup: `const { session } = await requireArea("staff");` (import `requireArea` from `@/lib/session` if not already imported).
- Add `listOrderComments(id)` to the existing `Promise.all`:
  ```ts
  const [finance, orderDocuments, orderComments] = await Promise.all([
    orderFinance(id),
    listOrderDocuments(id),
    listOrderComments(id),
  ]);
  ```
- Pass a `comments` prop to `<OrderDetailTabs ... />`:
  ```tsx
  comments={<CommentsTab orderId={id} comments={orderComments} currentUserId={session.user.id} />}
  ```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comments/comments-tab.tsx src/modules/orders/order-detail-tabs.tsx "src/app/(staff)/orders/[id]/page.tsx"
git commit -m "feat(comments): order Comments tab (chat with polling)"
```

---

## Task 9: i18n — comments namespace

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`, `messages/az.json`

- [ ] **Step 1: Add the `comments` namespace to all three catalogs**

Add (translate values per language; EN shown):

`messages/en.json`:
```json
"comments": {
  "tab": "Comments",
  "empty": "No comments yet",
  "placeholder": "Write a message…",
  "send": "Send",
  "sending": "Sending…"
}
```

`messages/ru.json`:
```json
"comments": {
  "tab": "Комментарии",
  "empty": "Пока нет комментариев",
  "placeholder": "Напишите сообщение…",
  "send": "Отправить",
  "sending": "Отправка…"
}
```

`messages/az.json`:
```json
"comments": {
  "tab": "Şərhlər",
  "empty": "Hələ şərh yoxdur",
  "placeholder": "Mesaj yazın…",
  "send": "Göndər",
  "sending": "Göndərilir…"
}
```

- [ ] **Step 2: Verify key parity**

Run:
```bash
node -e "const a=require('./messages/en.json'),b=require('./messages/ru.json'),c=require('./messages/az.json');const k=o=>Object.keys(o).flatMap(x=>typeof o[x]==='object'?Object.keys(o[x]).map(y=>x+'.'+y):[x]).sort();const ka=k(a),kb=k(b),kc=k(c);console.log('en',ka.length,'ru',kb.length,'az',kc.length);console.log('match', JSON.stringify(ka)===JSON.stringify(kb)&&JSON.stringify(kb)===JSON.stringify(kc));"
```
Expected: all three counts equal (207); `match true`.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/ru.json messages/az.json
git commit -m "i18n(comments): add comments namespace (en/ru/az)"
```

---

## Task 10: Phase close — browser verification + final gate

**Files:** none (verification + cleanup only)

- [ ] **Step 1: Bring up the stack**

Run: `docker compose up -d postgres minio mailpit app-dev` then confirm the app responds and Mailpit UI is reachable.
- App: `http://localhost:3000`
- Mailpit: `http://localhost:8025`

- [ ] **Step 2: Browser verification (Playwright MCP), signed in as admin**

Verify the full collaboration flow:
1. Create an account with at least one **contact email**, and a carrier with a contact email; create an order linking both → in Mailpit, an **order-created** email to the client + carrier appears.
2. Open the order → **Comments** tab → send a message → it appears right-aligned ("mine"); author + timestamp shown. A **new-comment** email to the client appears in Mailpit.
3. Change the order status → a **status-changed** email to the client appears in Mailpit.
4. Reload / wait 15s → polling refreshes the thread (no dupes).
5. Switch locale to RU → tab reads "Комментарии", placeholder/empty/ send localized.
6. Operator (non-admin) can also open the Comments tab and post.
7. Audit log shows a `comment_added` entry for the order.

- [ ] **Step 3: Verify the outbox drains**

Query the DB: pending notifications reach `status = 'sent'` (with `sent_at` set) within ~15s; none stuck `pending` with `attempts >= 3`. (A `failed` row only if SMTP is down.)

- [ ] **Step 4: Clean up test data + iCloud conflict files**

Delete the test order/comments/notifications/audit rows created during verification; remove any `.playwright-mcp` artifacts; sweep iCloud `* 2.*` conflict files:
```bash
find . -name "* 2.*" -not -path "*/node_modules/*" -delete
```

- [ ] **Step 5: Final gate**

Run: `rm -rf .next && npx tsc --noEmit && npm run lint && npm test && npm run build && npx tsx --env-file=.env scripts/check-schema.mts`
Expected: tsc/lint clean; all tests pass; build succeeds; schema check reports 16 tables, no drift.

- [ ] **Step 6: Commit the phase close (if anything pending)**

```bash
git add -A && (git diff --cached --quiet && echo "nothing to commit" || git commit -m "chore: close phase 4b — collaboration verified")
```

---

## Self-Review notes (author)

- **Spec coverage:** comment chat (✓ T3/T6/T8), email outbox (✓ T1/T4), SMTP worker with retry (✓ T2/T5, 3-attempt bound), invitation links → real emails (✓ T7). Triggers: order-created (✓ T7 createOrder), status-changed (✓ T7 changeOrderStatus), new-comment (✓ T6). Recipients: client + carrier contacts (✓ recipients.ts).
- **Atomicity:** every enqueue runs inside the triggering action's `db.transaction` — no orphan/lost emails on rollback.
- **Type consistency:** `EmailContent` ({subject, body}) flows from `templates.ts` → `enqueueMany`/`enqueueNotification` → `notifications` rows → `worker` `sendMail`. `CommentRow` shared by query → tab via `import type`. `DbExecutor` is the shared tx type (exported in T4 Step 1).
- **Deferred (documented):** email localization (recipient locale not stored — English v1); client-side ("other side") notification targeting beyond client contacts (portal arrives Phase 5); multi-instance worker locking (single-instance assumption — add a `SELECT ... FOR UPDATE SKIP LOCKED` claim if horizontally scaled).
- **No placeholders:** all steps contain concrete code/commands. The only conditional fallbacks are explicit verifications (`user.name` vs `user.email`, `session.user.name` presence) tied to a tsc check.
