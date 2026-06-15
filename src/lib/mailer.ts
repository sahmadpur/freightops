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
