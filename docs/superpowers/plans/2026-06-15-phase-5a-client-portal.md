# FreightOps Phase 5a — Client Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give client users a read-only portal to see their own company's orders, download the documents staff marked client-visible, and exchange comments with staff — with each side notified of the other's new messages.

**Architecture:** A new `(portal)` route area (layout + `requireArea("portal")` already exist) renders a My Orders list and a read-only order detail, both scoped to `user.accountId`. The existing document-download route is generalized to allow a client to fetch a `visible_to_client` document whose order belongs to their account. The comment system gains a client-side action (`addClientComment`) that authorizes by account ownership and notifies the staff side; the shared `CommentsTab` is parametrized with a send-action prop so staff and portal reuse one chat UI.

**Tech Stack:** Next.js 16 (App Router, Server Actions, route handlers), Drizzle ORM + Postgres 16, Better Auth (roles admin/operator/client; `requireArea`), next-intl (en/ru/az), MinIO/S3 (server-proxied download), Vitest, Docker Compose.

---

## Context for the implementer (read before starting)

- **Roles & areas** (`src/lib/roles.ts`): `Role = admin|operator|client`, `Area = staff|portal|admin`. `canAccess("portal", role)` is true only for `client`. `requireArea(area)` (`src/lib/session.ts`) returns `{ session, role }`, redirects unauthenticated/`active===false` users to `/sign-in`, and redirects wrong-area users to `homeFor(role)` (client → `/portal`). `getSession()` returns the raw session or null.
- **Client ↔ account link**: `user.accountId` (`src/db/schema/auth.ts`) FKs `accounts.id`. A client only ever sees data for their `accountId`. `session.user` exposes `id`, `name`, `email`, `role`, `accountId`, `active`, `language`.
- **Portal shell already exists**: `src/app/(portal)/portal/layout.tsx` wraps children with `<Topbar userName=... />` inside `requireArea("portal")`. `src/app/(portal)/portal/page.tsx` is a placeholder ("Coming in Phase 5.") to be replaced.
- **Existing queries/actions to reuse**:
  - `listOrderComments(orderId)` → `CommentRow[]` (`src/modules/comments/queries.ts`).
  - `addComment(orderId, input)` (staff; notifies client) and the `CommentsTab` client component (`src/modules/comments/`).
  - `getDocument(id)` → full document row incl. `parentType`, `parentId`, `visibleToClient`, `s3Key`, `fileName` (`src/modules/documents/queries.ts`).
  - `getObject(s3Key)` (`src/lib/s3.ts`).
  - `enqueueMany`/`enqueueNotification` (`src/modules/notifications/enqueue.ts`), `newCommentEmail(...)` (`.../templates.ts`), `orderRecipients(tx, orderId)` (`.../recipients.ts`).
  - `recordAudit(tx, {...})` (`src/lib/audit.ts`); `DbExecutor` is `Pick<typeof db, "insert">` (insert-only) — a helper needing `.select` types its param `Pick<typeof db, "select">`.
  - `ActionResult` (`src/lib/forms.ts`): `{ ok: true; id: string } | { ok: false; error?: string; fieldErrors?: Record<string,string[]> }`.
- **Conventions**: every mutation action starts with `await requireArea(<area>)` and writes audit rows via `recordAudit(tx, …)` INSIDE the `db.transaction`; notification enqueues happen in the same tx. Client components `import type` from db-importing modules and value-import only server actions. After a successful action, client handlers call `router.refresh()` (alone). No new DB migration in this phase (no schema changes).
- **i18n**: `messages/{en,ru,az}.json`, currently 207 keys each, must stay at parity. Reuse existing `fields.*`, `status.*`, `documents.*`, `comments.*`, `nav.myOrders` where possible; add a small `portal` namespace.

---

## File Structure

**Create:**
- `src/lib/document-access.ts` + `src/lib/document-access.test.ts` — pure `clientMayDownload(...)` predicate
- `src/app/(portal)/portal/orders/[id]/page.tsx` — read-only client order detail
- `src/modules/portal/order-detail.tsx` — portal detail presentation (info + documents + comments)

**Modify:**
- `src/modules/orders/queries.ts` — add `listClientOrders`, `getClientOrder`
- `src/modules/documents/queries.ts` — add `listVisibleOrderDocuments`
- `src/modules/notifications/recipients.ts` — add `staffRecipientsForOrder`
- `src/modules/comments/actions.ts` — add `addClientComment`
- `src/modules/comments/comments-tab.tsx` — parametrize with a `sendAction` prop
- `src/app/(staff)/orders/[id]/page.tsx` — pass `sendAction={addComment}` to `CommentsTab`
- `src/app/api/documents/[id]/download/route.ts` — allow authorized client downloads
- `src/app/(portal)/portal/page.tsx` — My Orders list (replaces placeholder)
- `messages/{en,ru,az}.json` — add `portal` namespace

---

## Execution waves (for the controller)

- **Wave 1 (parallel, disjoint files):** T1 (client order queries), T2 (visible-docs query + download authz), T3 (client comment + staff recipients + parametrized CommentsTab + staff page), T6 (i18n)
- **Wave 2 (parallel):** T4 (My Orders page), T5 (portal order detail page + presentation)
- **Wave 3:** T7 (browser verification + phase close)

---

## Task 1: Client-scoped order queries

**Files:**
- Modify: `src/modules/orders/queries.ts`

- [ ] **Step 1: Add `listClientOrders` and `getClientOrder`**

Append to `src/modules/orders/queries.ts` (the imports `and, desc, eq, ilike, or` from drizzle-orm and `orders, accounts, transportModes` are already imported):

```ts
export type ClientOrderListRow = {
  id: string;
  number: string;
  title: string;
  route: string | null;
  transportNumber: string | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** Orders belonging to one client account (portal My Orders), newest first. */
export async function listClientOrders(accountId: string, opts: { q?: string; status?: string }): Promise<ClientOrderListRow[]> {
  const conds = [eq(orders.accountId, accountId)];
  if (opts.status && (orderStatusEnum.enumValues as readonly string[]).includes(opts.status)) {
    conds.push(eq(orders.status, opts.status as OrderStatus));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(orders.number, like), ilike(orders.title, like), ilike(orders.route, like))!);
  }
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      title: orders.title,
      route: orders.route,
      transportNumber: transportModes.number,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(transportModes, eq(orders.transportModeId, transportModes.id))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt));
  return rows as ClientOrderListRow[];
}

/**
 * One order, but ONLY if it belongs to `accountId` (portal access guard).
 * Returns null when the order doesn't exist or isn't owned by this client.
 */
export async function getClientOrder(id: string, accountId: string) {
  const [row] = await db
    .select({
      order: orders,
      accountTitle: accounts.title,
      carrierTitle: carriers.title,
      transportNumber: transportModes.number,
      transportModeType: transportModes.modeType,
    })
    .from(orders)
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .leftJoin(carriers, eq(orders.carrierId, carriers.id))
    .leftJoin(transportModes, eq(orders.transportModeId, transportModes.id))
    .where(and(eq(orders.id, id), eq(orders.accountId, accountId)))
    .limit(1);
  return row ?? null;
}
```

(`carriers` is already imported in this file. `orderStatusEnum` and `OrderStatus` are already imported.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (Other agents may be editing concurrently — if so, scope to this file: `npx tsc --noEmit --skipLibCheck 2>&1 | grep "orders/queries"` and ensure no errors in it.)

- [ ] **Step 3: Commit**

```bash
git add src/modules/orders/queries.ts
git commit -m "feat(portal): account-scoped client order queries"
```

---

## Task 2: Client-visible documents query + client download authorization

**Files:**
- Create: `src/lib/document-access.ts`, `src/lib/document-access.test.ts`
- Modify: `src/modules/documents/queries.ts`, `src/app/api/documents/[id]/download/route.ts`

- [ ] **Step 1: Write the failing test for the access predicate**

Create `src/lib/document-access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clientMayDownload } from "./document-access";

const visibleOrderDoc = { parentType: "order" as const, visibleToClient: true };

describe("clientMayDownload", () => {
  it("allows a client to download a visible order doc owned by their account", () => {
    expect(clientMayDownload(visibleOrderDoc, "acc-1", "acc-1")).toBe(true);
  });
  it("denies when the order belongs to a different account", () => {
    expect(clientMayDownload(visibleOrderDoc, "acc-2", "acc-1")).toBe(false);
  });
  it("denies when the doc is not client-visible", () => {
    expect(clientMayDownload({ parentType: "order", visibleToClient: false }, "acc-1", "acc-1")).toBe(false);
  });
  it("denies non-order documents (e.g. transport_mode)", () => {
    expect(clientMayDownload({ parentType: "transport_mode", visibleToClient: true }, "acc-1", "acc-1")).toBe(false);
  });
  it("denies when the client has no account", () => {
    expect(clientMayDownload(visibleOrderDoc, "acc-1", null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/lib/document-access.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the predicate**

Create `src/lib/document-access.ts`:

```ts
/**
 * Pure authorization predicate: may a client download this document?
 * Only client-visible documents attached to an ORDER owned by the client's account.
 */
export function clientMayDownload(
  doc: { parentType: string; visibleToClient: boolean },
  orderAccountId: string | null,
  userAccountId: string | null,
): boolean {
  if (doc.parentType !== "order") return false;
  if (!doc.visibleToClient) return false;
  if (!userAccountId || !orderAccountId) return false;
  return orderAccountId === userAccountId;
}
```

- [ ] **Step 4: Run the test, confirm it passes (5 tests).**

- [ ] **Step 5: Add the visible-documents query**

Append to `src/modules/documents/queries.ts` (reuses the existing `DocumentRow` type, `db`, `documents`, `and`, `eq`, `desc`):

```ts
/** Order documents that staff marked client-visible (portal order detail), newest first. */
export async function listVisibleOrderDocuments(orderId: string): Promise<DocumentRow[]> {
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
    .where(and(eq(documents.parentType, "order"), eq(documents.parentId, orderId), eq(documents.visibleToClient, true)))
    .orderBy(desc(documents.createdAt));
  return rows;
}
```

- [ ] **Step 6: Generalize the download route for authorized clients**

Replace the contents of `src/app/api/documents/[id]/download/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession } from "@/lib/session";
import { getDocument } from "@/modules/documents/queries";
import { getObject } from "@/lib/s3";
import { clientMayDownload } from "@/lib/document-access";
import type { Role } from "@/lib/roles";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.user.active === false) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const role = session.user.role as Role;
  const isStaff = role === "admin" || role === "operator";
  if (!isStaff) {
    // Client: only own-account order's client-visible documents.
    let orderAccountId: string | null = null;
    if (doc.parentType === "order") {
      const [o] = await db.select({ accountId: orders.accountId }).from(orders).where(eq(orders.id, doc.parentId)).limit(1);
      orderAccountId = o?.accountId ?? null;
    }
    if (!clientMayDownload(doc, orderAccountId, session.user.accountId ?? null)) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const { body, contentType } = await getObject(doc.s3Key);
  const encoded = encodeURIComponent(doc.fileName);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      "Content-Length": String(body.length),
    },
  });
}
```

- [ ] **Step 7: Verify**

Run: `npx vitest run src/lib/document-access.test.ts` (5 pass). Scoped type-check: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -iE "document-access|documents/queries|download/route"` — fix any errors in your files.

- [ ] **Step 8: Commit**

```bash
git add src/lib/document-access.ts src/lib/document-access.test.ts src/modules/documents/queries.ts "src/app/api/documents/[id]/download/route.ts"
git commit -m "feat(portal): client-visible docs query + authorized client downloads"
```

---

## Task 3: Client comment action + staff-side notification + shared chat UI

**Files:**
- Modify: `src/modules/notifications/recipients.ts`, `src/modules/comments/actions.ts`, `src/modules/comments/comments-tab.tsx`, `src/app/(staff)/orders/[id]/page.tsx`

- [ ] **Step 1: Add a staff-recipients helper**

Append to `src/modules/notifications/recipients.ts` (it already imports `eq`, `db`, `orders`; add `user` to the `@/db/schema` import and keep the existing `SelectExecutor` type):

```ts
/** Staff email(s) to notify about client activity on an order: the order's creator. */
export async function staffRecipientsForOrder(tx: Pick<typeof db, "select">, orderId: string): Promise<string[]> {
  const [row] = await tx
    .select({ email: user.email, active: user.active })
    .from(orders)
    .innerJoin(user, eq(orders.createdBy, user.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row || row.active === false || !row.email) return [];
  return [row.email];
}
```

(Update the import to `import { contacts, orders, user } from "@/db/schema";`.)

- [ ] **Step 2: Add the `addClientComment` action**

Append to `src/modules/comments/actions.ts` (it already imports `eq`, `db`, `comments`, `orders`, `recordAudit`, `commentInputSchema`, `enqueueMany`, `newCommentEmail`, `ActionResult`; add `requireArea` is already imported, add `staffRecipientsForOrder`):

```ts
import { staffRecipientsForOrder } from "@/modules/notifications/recipients";

export async function addClientComment(orderId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("portal");
  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const body = parsed.data.body;

  const result = await db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    // Ownership guard: the client may only comment on their own account's orders.
    if (!order || order.accountId !== session.user.accountId) return "not_found" as const;

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

    // Notify the staff side (the order's creator).
    const staffEmails = await staffRecipientsForOrder(tx, orderId);
    if (staffEmails.length) {
      await enqueueMany(
        tx,
        staffEmails,
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

(Note: the staff link `/orders/${orderId}` is correct — the recipient is staff.)

- [ ] **Step 3: Parametrize `CommentsTab` with a send action**

In `src/modules/comments/comments-tab.tsx`:
- Remove `import { addComment } from "./actions";`.
- Add `import type { ActionResult } from "@/lib/forms";`.
- Add a prop `sendAction: (orderId: string, input: { body: string }) => Promise<ActionResult>` to the component's props type/destructure.
- In `send()`, replace `await addComment(orderId, { body: text })` with `await sendAction(orderId, { body: text })`.

(Everything else — polling, scroll, rendering — stays identical.)

- [ ] **Step 4: Pass the staff action from the staff order page**

In `src/app/(staff)/orders/[id]/page.tsx`:
- Add `import { addComment } from "@/modules/comments/actions";`.
- Update the `CommentsTab` usage to pass the action prop:
  ```tsx
  comments={<CommentsTab orderId={id} comments={orderComments} currentUserId={session.user.id} sendAction={addComment} />}
  ```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -iE "comments/actions|comments-tab|recipients|orders/\[id\]"` — fix any errors in your files. Then full `npm test` is run by the controller in the gate.

- [ ] **Step 6: Commit**

```bash
git add src/modules/notifications/recipients.ts src/modules/comments/actions.ts src/modules/comments/comments-tab.tsx "src/app/(staff)/orders/[id]/page.tsx"
git commit -m "feat(portal): client comment action (notifies staff) + shared CommentsTab"
```

---

## Task 4: Portal My Orders page

**Files:**
- Modify: `src/app/(portal)/portal/page.tsx`

- [ ] **Step 1: Replace the placeholder with the My Orders list**

Read the staff orders list page (`src/app/(staff)/orders/page.tsx`) for the table/StatusBadge/Card pattern and the `searchParams` convention, then write `src/app/(portal)/portal/page.tsx`:

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { listClientOrders } from "@/modules/orders/queries";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { session } = await requireArea("portal");
  const t = await getTranslations();
  const sp = await searchParams;
  const accountId = session.user.accountId;
  const orders = accountId ? await listClientOrders(accountId, { q: sp.q, status: sp.status }) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("nav.myOrders")}</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">{t("portal.noOrders")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">{t("fields.orderId")}</th>
                <th className="px-4 py-2">{t("fields.orderTitle")}</th>
                <th className="px-4 py-2">{t("fields.route")}</th>
                <th className="px-4 py-2">{t("fields.status")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/portal/orders/${o.id}`} className="font-medium text-[#1a3a5c] hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{o.title}</td>
                  <td className="px-4 py-2 text-slate-500">{o.route ?? "—"}</td>
                  <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

(Confirmed keys: `fields.orderId` = "Order ID", `fields.orderTitle` = "Order title", `fields.route`, `fields.status` all exist; `StatusBadge` is at `src/components/ui/status-badge.tsx` and accepts a `status: string`.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "portal/page"` — fix errors in this file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(portal)/portal/page.tsx"
git commit -m "feat(portal): My Orders list (account-scoped)"
```

---

## Task 5: Portal order detail (read-only info + documents + comments)

**Files:**
- Create: `src/modules/portal/order-detail.tsx`, `src/app/(portal)/portal/orders/[id]/page.tsx`

- [ ] **Step 1: Build the portal detail presentation (server component)**

Create `src/modules/portal/order-detail.tsx`:

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CommentsTab } from "@/modules/comments/comments-tab";
import { addClientComment } from "@/modules/comments/actions";
import type { DocumentRow } from "@/modules/documents/queries";
import type { CommentRow } from "@/modules/comments/queries";

type DetailOrder = {
  id: string;
  number: string;
  title: string;
  route: string | null;
  status: string;
  cargoDescription: string | null;
};

export async function PortalOrderDetail({
  order,
  carrierTitle,
  transportNumber,
  documents,
  comments,
  currentUserId,
}: {
  order: DetailOrder;
  carrierTitle: string | null;
  transportNumber: string | null;
  documents: DocumentRow[];
  comments: CommentRow[];
  currentUserId: string;
}) {
  const t = await getTranslations();
  const td = await getTranslations("docType");

  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal" className="text-sm text-[#1a3a5c] hover:underline">← {t("nav.myOrders")}</Link>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{order.number}</h1>
        <StatusBadge status={order.status} />
      </div>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{order.title}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {row(t("fields.route"), order.route)}
            {row(t("fields.carrier"), carrierTitle)}
            {row(t("fields.transport"), transportNumber)}
            {row(t("fields.cargoDescription"), order.cargoDescription)}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("documents.tab")}</span></CardHeader>
        <CardBody>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-400">{t("portal.noDocuments")}</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="flex-1 truncate">
                    <span className="font-medium">{d.fileName}</span>
                    <span className="ml-2 text-xs text-slate-400">{td(d.docType)}</span>
                  </span>
                  <a href={`/api/documents/${d.id}/download`} className="text-xs text-[#1a3a5c] hover:underline">{t("documents.download")}</a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("comments.tab")}</span></CardHeader>
        <CardBody>
          <CommentsTab orderId={order.id} comments={comments} currentUserId={currentUserId} sendAction={addClientComment} />
        </CardBody>
      </Card>
    </div>
  );
}
```

(Confirm `Card`/`CardBody`/`CardHeader` exports and i18n keys `fields.carrier`, `fields.transport`, `fields.cargoDescription`, `documents.tab`, `documents.download`, `comments.tab` exist — adjust to the real keys if any differ.)

- [ ] **Step 2: Build the page with the ownership guard**

Create `src/app/(portal)/portal/orders/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/session";
import { getClientOrder } from "@/modules/orders/queries";
import { listVisibleOrderDocuments } from "@/modules/documents/queries";
import { listOrderComments } from "@/modules/comments/queries";
import { PortalOrderDetail } from "@/modules/portal/order-detail";

export default async function PortalOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireArea("portal");
  const { id } = await params;
  const accountId = session.user.accountId;
  const data = accountId ? await getClientOrder(id, accountId) : null;
  if (!data) notFound();

  const [documents, comments] = await Promise.all([
    listVisibleOrderDocuments(id),
    listOrderComments(id),
  ]);

  return (
    <PortalOrderDetail
      order={{
        id: data.order.id,
        number: data.order.number,
        title: data.order.title,
        route: data.order.route,
        status: data.order.status,
        cargoDescription: data.order.cargoDescription,
      }}
      carrierTitle={data.carrierTitle}
      transportNumber={data.transportNumber}
      documents={documents}
      comments={comments}
      currentUserId={session.user.id}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -iE "portal/order-detail|portal/orders"` — fix errors in your files.

- [ ] **Step 4: Commit**

```bash
git add src/modules/portal/order-detail.tsx "src/app/(portal)/portal/orders/[id]/page.tsx"
git commit -m "feat(portal): read-only order detail with documents and comments"
```

---

## Task 6: i18n — portal namespace

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`, `messages/az.json`

- [ ] **Step 1: Add a `portal` namespace to all three catalogs**

Add (translate per language; EN shown):

`messages/en.json`:
```json
"portal": {
  "noOrders": "You have no orders yet",
  "noDocuments": "No documents available"
}
```

`messages/ru.json`:
```json
"portal": {
  "noOrders": "У вас пока нет заказов",
  "noDocuments": "Нет доступных документов"
}
```

`messages/az.json`:
```json
"portal": {
  "noOrders": "Hələ sifarişiniz yoxdur",
  "noDocuments": "Sənəd yoxdur"
}
```

- [ ] **Step 2: Verify parity**

Run:
```bash
node -e "const a=require('./messages/en.json'),b=require('./messages/ru.json'),c=require('./messages/az.json');const k=o=>Object.keys(o).flatMap(x=>typeof o[x]==='object'&&o[x]!==null?Object.keys(o[x]).map(y=>x+'.'+y):[x]).sort();const ka=k(a),kb=k(b),kc=k(c);console.log('en',ka.length,'ru',kb.length,'az',kc.length);console.log('match', JSON.stringify(ka)===JSON.stringify(kb)&&JSON.stringify(kb)===JSON.stringify(kc));"
```
Expected: all three equal (209); `match true`.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/ru.json messages/az.json
git commit -m "i18n(portal): add portal namespace (en/ru/az)"
```

---

## Task 7: Phase close — browser verification + final gate

**Files:** none (verification + cleanup only). Reuses any keys the pages reference — fix mismatches found here in the owning task's file.

- [ ] **Step 1: Bring up the stack**

Run: `docker compose up -d postgres minio mailpit app-dev` and confirm `http://localhost:3000/sign-in` returns 200.

- [ ] **Step 2: Create a client user tied to an account**

Write a one-off script `scripts/seed-client.mts` (mirror `scripts/seed-admin.mts`) that calls `createUserWithPassword({ email: "client@verifyco.test", password: "client12345", name: "Verify Client", role: "client", accountId: <Verify Co account id> })`. Find the account id with:
`docker compose exec -T postgres psql -U freightops -d freightops -c "select id,title from accounts;"`
Run: `npx tsx --env-file=.env scripts/seed-client.mts`. (Delete the script after, or keep it alongside seed-admin — controller's choice; if kept, ensure it lint/type-checks.)

Ensure that account has at least one order with a client-visible document and a comment (create via the staff UI signed in as admin if needed, marking a document "Client visible").

- [ ] **Step 3: Browser verification (Playwright MCP)**

As the **client** (`client@verifyco.test`):
1. Sign in → redirected to `/portal` (My Orders), seeing ONLY their account's orders.
2. Open an order → read-only detail: info card, **only client-visible** documents listed (an internal-only doc must NOT appear), comments thread.
3. Download a client-visible document → 200, correct file.
4. Post a comment → appears in the thread; in Mailpit a "New comment" email goes to the **staff** order-creator address; a `comment_added` audit row exists.
5. Attempt to reach another account's order by URL (`/portal/orders/<id-not-owned>`) → 404 (not found). Attempt `/orders` (staff area) → redirected to `/portal`.
6. Switch locale to RU → portal strings localized.

As **staff** (admin): open the same order's Comments tab → the client's message is visible; posting a staff reply still emails the client (regression check of the parametrized `CommentsTab`).

Security (terminal): `curl` the download URL for an internal-only (not client-visible) doc with the client session cookie → 404; with no session → 401.

- [ ] **Step 4: Clean up + sweep**

Delete verification test data you created (extra orders/comments/notifications/audit; keep or remove the client user as you prefer for 5b). Remove `.playwright-mcp`. Sweep iCloud conflicts:
```bash
find . -name "* 2.*" -not -path "*/node_modules/*" -delete
```

- [ ] **Step 5: Final gate**

Run: `rm -rf .next && npx tsc --noEmit && npm run lint && npm test && npm run build && npx tsx --env-file=.env scripts/check-schema.mts`
Expected: tsc/lint clean; all tests pass; build succeeds; schema check **16 tables** (no migration this phase).

- [ ] **Step 6: Commit the phase close (if anything pending)**

```bash
git add -A && (git diff --cached --quiet && echo "nothing to commit" || git commit -m "chore: close phase 5a — client portal verified")
```

---

## Self-Review notes (author)

- **Spec coverage:** client sees own orders (✓ T1/T4 account-scoped query + page), read-only order detail (✓ T5), client-visible documents only (✓ T2 query filters `visibleToClient` + T5), client downloads gated (✓ T2 route + `clientMayDownload`), comment chat both directions (✓ staff→client existing + T3 client→staff with notification), portal access isolation (✓ `requireArea("portal")` + `getClientOrder` ownership guard + `clientMayDownload`).
- **Authorization defense-in-depth:** three independent gates — `requireArea("portal")` (area), `getClientOrder(id, accountId)`/`order.accountId === user.accountId` (record ownership), and `clientMayDownload` (document visibility + ownership). No client path reaches finance, status mutation, edit, or non-visible documents.
- **Type consistency:** `ClientOrderListRow`/`DocumentRow`/`CommentRow` shared via `import type`; `CommentsTab.sendAction` signature matches both `addComment` and `addClientComment` (`(orderId, {body}) => Promise<ActionResult>`); `clientMayDownload(doc, orderAccountId, userAccountId)` arg order identical in test, route, and impl.
- **No new migration:** no schema changes (the columns — `user.accountId`, `documents.visible_to_client`, `orders.createdBy` — already exist). Schema check stays at 16 tables.
- **Deferred to 5b:** Users & Roles admin UI + invitation creation UI (createInvitation already enqueues the email), Audit Log viewer, transport-mode document UI. Email localization remains deferred (recipient locale not stored).
- **No placeholders:** every step has concrete code/commands; the only conditionals are explicit "verify the real i18n key / Card export and adjust" checks tied to a scoped tsc/grep.
