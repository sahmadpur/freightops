// One-off SMTP smoke test. Run: npx tsx --env-file=.env scripts/send-test-mail.mts
// Uses the app's real mailer (src/lib/mailer.ts) against the .env SMTP credentials.

// Resend rejects unverified From addresses; default to its no-verification sender
// unless the operator has set a verified SMTP_FROM in .env.
process.env.SMTP_FROM ??= "FreightOps <onboarding@resend.dev>";

const to = process.env.TEST_MAIL_TO ?? "sohrab.ahmadpur@gmail.com";

const { sendMail } = await import("../src/lib/mailer");

console.log(`Sending test email via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} from ${process.env.SMTP_FROM} → ${to}`);
try {
  await sendMail({
    to,
    subject: "FreightOps SMTP test",
    text:
      "This is a test email from FreightOps confirming the SMTP credentials work.\n\n" +
      "If you received this, outbound email (order/comment/invitation notifications) is wired up correctly.\n",
  });
  console.log("OK — send accepted by the SMTP server.");
  process.exit(0);
} catch (err) {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
}
