import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Middleware paths have basePath stripped, but redirect targets need it back.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL(`${basePath}/sign-in`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Only /api/auth is public; all other /api/* routes are intentionally gated.
  matcher: [
    "/((?!api/auth(?:/|$)|sign-in(?:/|$)|accept-invitation(?:/|$)|forgot-password(?:/|$)|reset-password(?:/|$)|_next(?:/|$)|favicon\\.ico).*)",
  ],
};
