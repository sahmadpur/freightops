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
  // Static assets are public too: the logo and the icons are needed on the
  // sign-in page itself, and the image optimizer re-fetches them with no
  // session cookie — gating them turns the asset into a redirect to /sign-in.
  matcher: [
    "/((?!api/auth(?:/|$)|sign-in(?:/|$)|accept-invitation(?:/|$)|forgot-password(?:/|$)|reset-password(?:/|$)|_next(?:/|$)|[^?]*\\.(?:png|jpe?g|svg|webp|gif|ico|webmanifest|txt|xml)$).*)",
  ],
};
