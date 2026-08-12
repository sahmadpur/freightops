import { expect, type Locator, type Page } from "@playwright/test";

export const AUTH_STATE = "tests/e2e/.auth/state.json";
export const ADMIN = { email: "admin@freightops.local", password: "admin12345" };

/** Unique suffix so re-runs never collide and never touch each other's rows. */
export const uid = () => Math.random().toString(36).slice(2, 8);

/**
 * The wrapper `div` of a `<Field>`. Field now generates an id and associates
 * the label (src/components/ui/field.tsx), but leg and cargo fields repeat the
 * same label once per leg, so scoping by wrapper stays the unambiguous way in.
 */
export function field(scope: Page | Locator, label: string): Locator {
  return scope.locator(`div:has(> label:text-is(${JSON.stringify(label)}))`).first();
}

/** The plain text input/textarea of a Field. */
export function input(scope: Page | Locator, label: string): Locator {
  return field(scope, label).locator("input, textarea").first();
}

/**
 * Drive a custom Combobox (src/components/ui/combobox.tsx): focus opens the
 * list, typing filters it, mousedown on an `<li role=option>` commits.
 */
export async function setCombo(
  scope: Page | Locator,
  label: string,
  query: string,
  option: string | RegExp = query,
): Promise<void> {
  const f = field(scope, label);
  const box = f.getByRole("combobox");
  await box.click();
  await box.fill(query);
  await f.getByRole("option", { name: option, exact: typeof option === "string" }).first().click();
}

/** Read a DefRow (`<dt>label</dt><dd>value</dd>`) from a detail page. */
export function defValue(scope: Page | Locator, label: string): Locator {
  return scope.locator(`div:has(> dt:text-is(${JSON.stringify(label)})) > dd`).first();
}

export async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

/** Collect console errors, page errors and 5xx responses for section 5.4. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

/**
 * The record number off a detail page ("Orders · ORD-2026-020"). The sidebar
 * also uses `.eyebrow`, so pick the one that actually holds a number.
 */
export async function recordNumber(page: Page): Promise<string> {
  const text = await page.locator(".eyebrow").filter({ hasText: /-\d{4}-\d+/ }).first().innerText();
  return text.match(/(?:ORD|REQ)-\d{4}-\d+/)![0];
}

/** Wait until a detail page for `kind` is open and return the record id. */
export async function waitForDetail(page: Page, kind: "requests" | "orders"): Promise<string> {
  const re = new RegExp(`/${kind}/([0-9a-f-]{36})$`);
  await expect(page).toHaveURL(re, { timeout: 30_000 });
  return page.url().match(re)![1];
}
