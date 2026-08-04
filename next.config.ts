import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Next blocks cross-origin requests to dev-only assets/endpoints. When the dev
// server is reached by IP or hostname instead of localhost (e.g. a remote
// container), list those origins in ALLOWED_DEV_ORIGINS (comma-separated).
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Serve the app under a URL prefix when it sits behind a path-preserving proxy
// (e.g. code-server's /absproxy/<port>). Empty/unset = served at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // The dockerized dev server (app-dev) uses its own dist dir so its Linux
  // build artifacts never mix with the host's .next via the bind mount.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // nodemailer is Node-only (used by the notification worker via instrumentation).
  // Opt it out of bundling so it isn't pulled into the browser/edge compile graph.
  // puppeteer-core (HTML→PDF document generation) is in Next's default external
  // list already; kept explicit here for the same reason.
  serverExternalPackages: ["nodemailer", "puppeteer-core"],
};

export default withNextIntl(nextConfig);
