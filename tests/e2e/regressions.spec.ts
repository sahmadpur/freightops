import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test.describe("5. Regressions", () => {
  test("5.1 orders list renders and the transport-type filter works", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Orders");
    await expect(page.getByRole("link", { name: /^ORD-/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "Filters" }).click();
    await page.locator("#f-type").selectOption("sea");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/type=sea/);

    const rows = page.getByRole("row").filter({ has: page.getByRole("link", { name: /^ORD-/ }) });
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    for (let i = 0; i < count; i++) await expect(rows.nth(i)).toContainText("Sea");
    // ORD-2026-011 is a truck order and must be filtered out.
    await expect(page.getByRole("link", { name: "ORD-2026-011" })).toHaveCount(0);
  });

  test("5.2 dashboard renders with no error", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status(), "GET /dashboard").toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("5.4 no console errors or 5xx on the pages visited", async ({ page }) => {
    const errors = watchErrors(page);
    for (const path of ["/orders", "/requests", "/accounts", "/carriers", "/orders/new", "/requests/new"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    const orderHref = await page.goto("/orders").then(() =>
      page.getByRole("link", { name: /^ORD-/ }).first().getAttribute("href"),
    );
    await page.goto(orderHref!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("6. Fixes from the first e2e run", () => {
  test("6.1 leg and cargo labels are associated with their controls", async ({ page }) => {
    await page.goto("/orders/new");
    // Field generates an id when the caller passes no htmlFor, so getByLabel
    // reaches controls that used to carry an orphaned <label>.
    await page.getByLabel("Transport type").click();
    await page.getByRole("option", { name: "Road" }).first().click();
    // Number of trucks belongs to the FTL branch of the leg editor.
    await page.getByLabel("Transport subtype").click();
    await page.getByRole("option", { name: "FTL" }).first().click();
    await expect(page.getByLabel("Number of trucks")).toBeVisible();
    await expect(page.getByLabel("Cargo description")).toBeVisible();
  });

  test("6.2 country search ignores accents", async ({ page }) => {
    await page.goto("/orders/new");
    await page.getByLabel("Transport type").click();
    await page.getByRole("option", { name: "Road" }).first().click();
    const box = page.getByLabel("Origin country");
    await box.click();
    await box.fill("Turk");
    await expect(page.getByRole("option", { name: /Türkiye|Turkey/ })).toBeVisible();
    await box.fill("Azerb");
    await expect(page.getByRole("option", { name: /Azərbaycan|Azerbaijan/ })).toBeVisible();
  });
});
