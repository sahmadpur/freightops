import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Only /api/auth is public; all other /api/* routes are intentionally gated.
  matcher: [
    "/((?!api/auth(?:/|$)|sign-in(?:/|$)|accept-invitation(?:/|$)|_next(?:/|$)|favicon\\.ico).*)",
  ],
};
