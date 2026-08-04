import { createAuthClient } from "better-auth/react";

// Keep the auth endpoints under the app's basePath when one is configured
// (see next.config.ts); defaults to the root-mounted "/api/auth".
export const authClient = createAuthClient({
  basePath: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/auth`,
});
export const { signIn, signOut, useSession, requestPasswordReset, resetPassword } = authClient;
