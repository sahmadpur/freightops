import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { enqueueNotification } from "@/modules/notifications/enqueue";
import { passwordResetEmail } from "@/modules/notifications/templates";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error("BETTER_AUTH_SECRET env var is required");

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      // Deactivated users can't sign in after a reset; skip silently so the
      // always-success API response leaks nothing about account state.
      if ((user as { active?: boolean }).active === false) return;
      const content = passwordResetEmail({ url });
      await enqueueNotification(db, {
        toEmail: user.email,
        subject: content.subject,
        body: content.body,
        relatedType: "password-reset",
      });
    },
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "operator", input: false },
      accountId: { type: "string", required: false, input: false },
      language: { type: "string", defaultValue: "en", input: false },
      active: { type: "boolean", defaultValue: true, input: false },
    },
  },
  secret,
  baseURL: process.env.BETTER_AUTH_URL,
});

export type Session = typeof auth.$Infer.Session;
