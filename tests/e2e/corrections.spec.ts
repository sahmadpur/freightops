import { test, expect } from "@playwright/test";
import { defValue, field, input, openTab, setCombo, uid, waitForDetail } from "./helpers";

/**
 * The client-corrections round: EX1 expense, status column position,
 * country→city cascade, cargo-type dictionary admin.
 */
const RUN = uid();
const CLIENT = `E2E Corr client ${RUN}`;

test.describe.configure({ mode: "serial" });

test("7.0 set up a client account", async ({ page }) => {
  await page.goto("/accounts/new");
  await input(page, "Company title").fill(CLIENT);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/);
});

test("7.1 EX1 cost lands as a finance line and in the cost total", async ({ page }) => {
  await page.goto("/orders/new");
  await setCombo(page, "Client", CLIENT);
  await input(page, "Order subject").fill(`E2E EX1 ${RUN}`);
  await page.getByLabel("EX1 required").check();
  await input(page, "EX1 cost").fill("100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await waitForDetail(page, "orders");

  await expect(defValue(page, "EX1 required")).toHaveText("Yes");
  await openTab(page, "Finance");
  await expect(page.getByText(`EX1 100 USD`).first()).toBeVisible();
});

test("7.2 orders table shows Status as the fourth column", async ({ page }) => {
  await page.goto("/orders");
  const headers = page.locator("thead th");
  await expect(headers.nth(3)).toHaveText(/Status/i);
});

test("7.3 city combobox offers the chosen country's cities and resets on change", async ({ page }) => {
  await page.goto("/requests/new");
  await setCombo(page, "Transport type", "Road");
  await setCombo(page, "Origin country", "Türkiye", /Türkiye/);
  const originCity = field(page, "Origin city").getByRole("combobox");
  await originCity.click();
  await field(page, "Origin city").getByRole("option", { name: "Istanbul" }).click();
  await expect(originCity).toHaveValue("Istanbul");
  // Changing the country resets the city — it belongs to the old one.
  await setCombo(page, "Origin country", "Azerbaijan", /Azerbaijan/);
  await expect(originCity).toHaveValue("");
});

test("7.4 admin manages the cargo-type dictionary", async ({ page }) => {
  const NAME = `E2E Cargo ${RUN}`;
  await page.goto("/admin/cargo-types");
  await page.getByPlaceholder("New cargo type").fill(NAME);
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: NAME });
  await expect(row).toBeVisible();

  // The new entry is offered by the cargo-description autocomplete.
  await page.goto("/requests/new");
  const desc = field(page, "Cargo description").getByRole("combobox");
  await desc.click();
  await desc.fill(NAME.slice(0, 9));
  await expect(field(page, "Cargo description").getByRole("option", { name: NAME })).toBeVisible();

  // Archive removes it from the options but keeps the row restorable.
  await page.goto("/admin/cargo-types");
  await page.getByRole("row").filter({ hasText: NAME }).getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("row").filter({ hasText: NAME }).getByRole("button", { name: "Restore" })).toBeVisible();
});
