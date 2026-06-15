export async function register(): Promise<void> {
  // Only run the worker in the Node.js server runtime (not edge, not build).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NOTIFICATIONS_WORKER === "off") return;
  const { startNotificationWorker } = await import("@/modules/notifications/worker");
  startNotificationWorker();
}
