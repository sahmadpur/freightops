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
