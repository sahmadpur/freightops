import { defineConfig } from "@playwright/test";

/**
 * E2E against the already-running dev app (docker compose `app-dev`).
 * `reuseExistingServer` keeps Playwright from starting one of its own.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.(spec|setup)\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    // Never actually run: the dev server is already up, so Playwright reuses it.
    command: "echo 'dev server must already be running on :3000' && exit 1",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 10_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "e2e",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/e2e/.auth/state.json" },
    },
  ],
});
