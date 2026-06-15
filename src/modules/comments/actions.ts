"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, orders } from "@/db/schema";
import { requireArea } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/forms";
import { commentInputSchema } from "./schema";
import { orderRecipients, staffRecipientsForOrder } from "@/modules/notifications/recipients";
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
