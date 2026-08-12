import { expect, test as setup } from "@playwright/test";
import { ADMIN, AUTH_STATE } from "./helpers";

setup("sign in as admin", async ({ page, context }) => {
  await context.addCookies([
    { name: "locale", value: "en", url: "http://localhost:3000" },
  ]);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/orders/, { timeout: 30_000 });
  await context.storageState({ path: AUTH_STATE });
});
