import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // The dockerized dev server (app-dev) uses its own dist dir so its Linux
  // build artifacts never mix with the host's .next via the bind mount.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // nodemailer is Node-only (used by the notification worker via instrumentation).
  // Opt it out of bundling so it isn't pulled into the browser/edge compile graph.
  serverExternalPackages: ["nodemailer"],
};

export default withNextIntl(nextConfig);
