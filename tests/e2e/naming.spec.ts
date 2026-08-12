import { expect, test } from "@playwright/test";

/** /orders, not /dashboard: the dashboard is 500ing on this environment (see report). */
const ANY_STAFF_PAGE = "/orders";

test.describe("1. Naming (Companies)", () => {
  test("1.1 sidebar shows Companies and links to /accounts", async ({ page }) => {
    await page.goto(ANY_STAFF_PAGE);
    const nav = page.locator("aside nav");
    const link = nav.getByRole("link", { name: "Companies" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/accounts");
    await expect(nav.getByRole("link", { name: "Accounts" })).toHaveCount(0);
  });

  test("1.2 /accounts page title, primary button and search placeholder", async ({ page }) => {
    await page.goto("/accounts");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Companies");
    await expect(page.getByRole("link", { name: "+ New company" })).toBeVisible();
    await expect(page.getByPlaceholder("Search companies...")).toBeVisible();
  });

  test("1.3 /carriers keeps its own labels and lists carriers only", async ({ page }) => {
    await page.goto("/carriers");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carriers");
    await expect(page.getByRole("link", { name: "+ New carrier" })).toBeVisible();
    await expect(page.getByPlaceholder("Search carriers...")).toBeVisible();
    const table = page.getByRole("table");
    // A carrier-role company shows; a client-only company does not.
    await expect(table.getByText("BTK Rail Cargo", { exact: true })).toBeVisible();
    await expect(table.getByText("Caspian Traders LLC", { exact: true })).toHaveCount(0);
  });

  for (const [locale, label] of [
    ["ru", "Компании"],
    ["az", "Şirkətlər"],
  ] as const) {
    test(`1.4 sidebar reads "${label}" with locale=${locale}`, async ({ page, context }) => {
      await context.addCookies([{ name: "locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto(ANY_STAFF_PAGE);
      const link = page.locator("aside nav").getByRole("link", { name: label });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/accounts");
    });
  }
});
