"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailMessages, requestEmails, requests } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireArea } from "@/lib/session";
import { linkMessageSchema, manualMessageSchema, type ActionResult } from "./schema";
import { searchLinkableMessages } from "./queries";

/**
 * Log a call or a WhatsApp exchange against a request (§18). Written into the
 * same table an Outlook sync will use, so the Communication tab is one
 * chronology rather than a mail feed with notes bolted beside it.
 */
export async function logMessage(requestId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = manualMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const result = await db.transaction(async (tx) => {
    const request = await tx.query.requests.findFirst({ where: eq(requests.id, requestId) });
    if (!request) return "not_found" as const;

    const at = d.occurredAt ? new Date(d.occurredAt) : new Date();
    const [message] = await tx
      .insert(emailMessages)
      .values({
        channel: d.channel,
        direction: d.direction,
        subject: d.subject || null,
        bodyText: d.body,
        // A logged call has one moment, recorded on the side it came from.
        receivedAt: d.direction === "incoming" ? at : null,
        sentAt: d.direction === "outgoing" ? at : null,
        createdBy: session.user.id,
      })
      .returning({ id: emailMessages.id });

    await tx.insert(requestEmails).values({
      requestId,
      messageId: message.id,
      linkedBy: session.user.id,
    });

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: requestId,
      action: "message_logged",
    });
    return message.id;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  return { ok: true, id: result };
}

/**
 * Attach an existing message to this request (§17.9). The link table is a
 * composite key, so re-linking the same message is a no-op rather than an error.
 */
export async function linkMessage(requestId: string, input: unknown): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  const parsed = linkMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const { messageId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const request = await tx.query.requests.findFirst({ where: eq(requests.id, requestId) });
    if (!request) return "not_found" as const;
    const message = await tx.query.emailMessages.findFirst({ where: eq(emailMessages.id, messageId) });
    if (!message) return "no_message" as const;

    await tx
      .insert(requestEmails)
      .values({ requestId, messageId, linkedBy: session.user.id })
      .onConflictDoNothing();

    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: requestId,
      action: "email_linked",
    });
    return "ok" as const;
  });

  if (result === "not_found") return { ok: false, error: "not_found" };
  if (result === "no_message") return { ok: false, error: "no_message" };
  return { ok: true, id: requestId };
}

/** Detach a message. The message itself survives — it may belong to other requests. */
export async function unlinkMessage(requestId: string, messageId: string): Promise<ActionResult> {
  const { session } = await requireArea("staff");
  await db.transaction(async (tx) => {
    await tx
      .delete(requestEmails)
      .where(and(eq(requestEmails.requestId, requestId), eq(requestEmails.messageId, messageId)));
    await recordAudit(tx, {
      userId: session.user.id,
      entityType: "request",
      entityId: requestId,
      action: "email_unlinked",
    });
  });
  return { ok: true, id: requestId };
}

/** Search for a message to link. Exposed as an action for the picker's live search. */
export async function findLinkableMessages(requestId: string, q: string) {
  await requireArea("staff");
  return searchLinkableMessages(requestId, q);
}
