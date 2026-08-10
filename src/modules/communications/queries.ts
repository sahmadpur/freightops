import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailAttachments, emailMessages, requestEmails, requests } from "@/db/schema";

export type MessageRow = {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  to: string[];
  cc: string[];
  bodyText: string | null;
  at: Date;
  attachments: { id: string; fileName: string; sizeBytes: number | null; documentId: string | null }[];
  /** Other requests this same message is linked to (§17.8). */
  alsoLinkedTo: { id: string; number: string }[];
};

/**
 * The Communication tab's chronology: emails and manually logged calls in one
 * list, newest first — the desk reads a conversation, not two feeds.
 */
export async function listRequestMessages(requestId: string): Promise<MessageRow[]> {
  const rows = await db
    .select({
      id: emailMessages.id,
      channel: emailMessages.channel,
      direction: emailMessages.direction,
      subject: emailMessages.subject,
      fromName: emailMessages.fromName,
      fromEmail: emailMessages.fromEmail,
      to: emailMessages.toJson,
      cc: emailMessages.ccJson,
      bodyText: emailMessages.bodyText,
      // Incoming messages are timestamped by arrival, outgoing by dispatch;
      // coalesce so one column orders the whole thread.
      at: sql<Date>`coalesce(${emailMessages.receivedAt}, ${emailMessages.sentAt}, ${emailMessages.createdAt})`,
    })
    .from(requestEmails)
    .innerJoin(emailMessages, eq(emailMessages.id, requestEmails.messageId))
    .where(eq(requestEmails.requestId, requestId))
    .orderBy(desc(sql`coalesce(${emailMessages.receivedAt}, ${emailMessages.sentAt}, ${emailMessages.createdAt})`));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [attachments, links] = await Promise.all([
    db
      .select({
        id: emailAttachments.id,
        messageId: emailAttachments.messageId,
        fileName: emailAttachments.fileName,
        sizeBytes: emailAttachments.sizeBytes,
        documentId: emailAttachments.documentId,
      })
      .from(emailAttachments)
      .where(sql`${emailAttachments.messageId} in ${ids}`),
    db
      .select({
        messageId: requestEmails.messageId,
        requestId: requests.id,
        number: requests.number,
      })
      .from(requestEmails)
      .innerJoin(requests, eq(requests.id, requestEmails.requestId))
      .where(and(sql`${requestEmails.messageId} in ${ids}`, sql`${requestEmails.requestId} <> ${requestId}`)),
  ]);

  return rows.map((r) => ({
    ...r,
    attachments: attachments
      .filter((a) => a.messageId === r.id)
      .map((a) => ({ id: a.id, fileName: a.fileName, sizeBytes: a.sizeBytes, documentId: a.documentId })),
    alsoLinkedTo: links.filter((l) => l.messageId === r.id).map((l) => ({ id: l.requestId, number: l.number })),
  }));
}

/**
 * Messages not yet linked to this request, for the "Link email to request"
 * picker (§17.9). Search-driven rather than a full list — a mailbox is large
 * and only the user knows which thread they mean.
 */
export async function searchLinkableMessages(requestId: string, q: string): Promise<
  { id: string; label: string }[]
> {
  const needle = q.trim();
  if (needle.length < 2) return [];
  const like = `%${needle}%`;
  const rows = await db
    .select({
      id: emailMessages.id,
      subject: emailMessages.subject,
      fromEmail: emailMessages.fromEmail,
      at: sql<Date>`coalesce(${emailMessages.receivedAt}, ${emailMessages.sentAt}, ${emailMessages.createdAt})`,
    })
    .from(emailMessages)
    .where(
      and(
        or(
          ilike(emailMessages.subject, like),
          ilike(emailMessages.fromEmail, like),
          ilike(emailMessages.bodyText, like),
        ),
        sql`not exists (select 1 from ${requestEmails} re
                        where re.message_id = ${emailMessages.id} and re.request_id = ${requestId})`,
      ),
    )
    .orderBy(desc(sql`coalesce(${emailMessages.receivedAt}, ${emailMessages.sentAt}, ${emailMessages.createdAt})`))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    label: [r.subject ?? "—", r.fromEmail].filter(Boolean).join(" · "),
  }));
}
