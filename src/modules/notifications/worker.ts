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
