import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

// Distro Chromium locations (Alpine names first — see Dockerfile runner stage).
const CHROMIUM_CANDIDATES = ["/usr/bin/chromium-browser", "/usr/bin/chromium"];

function executablePath(): string {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) return fromEnv;
  const found = CHROMIUM_CANDIDATES.find((p) => existsSync(p));
  if (found) return found;
  throw new Error(
    "No Chromium executable found for PDF generation. Set PUPPETEER_EXECUTABLE_PATH " +
      "to a Chrome/Chromium binary (see DEPLOY.md).",
  );
}

/**
 * Render an HTML string to A4 PDF bytes. Launches a browser per call and
 * always closes it — generation is a rare staff action, so a pooled browser
 * isn't worth the lifecycle complexity.
 *
 * --no-sandbox is required to run as the non-root `node` user in an
 * unprivileged container; the only input is our own server-generated HTML.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: executablePath(),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    // Our documents are self-contained HTML (no external resources), so
    // waiting for `load` is sufficient.
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
