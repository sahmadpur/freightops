import { expect, test, type Page } from "@playwright/test";
import { defValue, field, input, openTab, recordNumber, setCombo, uid, waitForDetail } from "./helpers";

const RUN = uid();
const CLIENT = "Caspian Traders LLC";
const TR = /^(Türkiye|Turkey)$/;
const AZ = "Azerbaijan";

const CARGO = `E2E road cargo ${RUN}`;
const CALL_BODY = `E2E logged call ${RUN}`;
const SEA_CARGO = `E2E sea cargo ${RUN}`;

let requestId = "";
let orderId = "";

/** The route/cargo blocks the order list row needs, for a Road FTL leg. */
async function fillRoadLeg(page: Page) {
  await setCombo(page, "Transport type", "Road");
  await setCombo(page, "Transport subtype", "FTL");
  await setCombo(page, "Origin country", "Turk", TR);
  await input(page, "Origin city").fill("Istanbul");
  await setCombo(page, "Destination country", AZ);
  await input(page, "Destination city").fill("Baku");
  await setCombo(page, "Vehicle type", "Curtainsider / tent");
  await input(page, "Number of trucks").fill("2");
}

test.describe.configure({ mode: "serial" });

test.describe("2. Request → order carries the shipment", () => {
  test("2.1 create a road request with a leg and cargo", async ({ page }) => {
    await page.goto("/requests/new");
    await setCombo(page, "Client", CLIENT);
    await setCombo(page, "Lead source", "Phone");
    await input(page, "Call / source note").fill(`Registered by e2e ${RUN}`);
    await fillRoadLeg(page);
    await input(page, "Cargo description").fill(CARGO);
    await input(page, "Gross weight (kg)").fill("18000");
    await page.getByRole("button", { name: "Save draft" }).click();
    requestId = await waitForDetail(page, "requests");
  });

  test("2.2 request detail shows the structured route and cargo", async ({ page }) => {
    await page.goto(`/requests/${requestId}`);
    await expect(page.getByText("Route & transport")).toBeVisible();
    await expect(defValue(page, "Transport type")).toHaveText("Road · FTL");
    await expect(defValue(page, "Origin country")).toContainText("Istanbul");
    await expect(defValue(page, "Origin country")).toContainText(/Türkiye|Turkey/);
    await expect(defValue(page, "Destination country")).toContainText("Baku");
    await expect(defValue(page, "Destination country")).toContainText(AZ);
    await expect(defValue(page, "Vehicle type")).toHaveText("Curtainsider / tent");
    await expect(defValue(page, "Number of trucks")).toHaveText("2");
    await expect(defValue(page, "Cargo description")).toHaveText(CARGO);
    await expect(defValue(page, "Gross weight (kg)")).toContainText("18000");
  });

  test("2.3 log a phone call on the request Communication tab", async ({ page }) => {
    await page.goto(`/requests/${requestId}`);
    await openTab(page, "Communication");
    await field(page, "Channel").locator("select").selectOption("phone");
    await field(page, "Direction").locator("select").selectOption("incoming");
    await field(page, "Summary").locator("textarea").fill(CALL_BODY);
    await page.getByRole("button", { name: "Log it" }).click();
    const entry = page.locator("li").filter({ hasText: CALL_BODY }).first();
    await expect(entry).toBeVisible();
    await expect(entry).toContainText("Phone · Incoming");
  });

  test("2.4 create a direct order from the request", async ({ page }) => {
    await page.goto(`/requests/${requestId}`);
    await page.getByRole("button", { name: "Create order", exact: true }).click();
    await page.getByLabel("Create order").selectOption("direct");
    await page.getByRole("button", { name: "Create order", exact: true }).click();
    orderId = await waitForDetail(page, "orders");
  });

  test("2.5 order Info tab shows the same route + cargo blocks", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText("Route & transport")).toBeVisible();
    await expect(defValue(page, "Transport type")).toHaveText("Road · FTL");
    await expect(defValue(page, "Origin country")).toContainText("Istanbul");
    await expect(defValue(page, "Destination country")).toContainText("Baku");
    await expect(defValue(page, "Vehicle type")).toHaveText("Curtainsider / tent");
    await expect(defValue(page, "Number of trucks")).toHaveText("2");
    await expect(defValue(page, "Cargo description")).toHaveText(CARGO);
    // The flat fallback pair is not rendered inside the Consignment section.
    const consignment = page.locator("dl").first();
    await expect(consignment.locator("dt", { hasText: "Route" })).toHaveCount(0);
  });

  test("2.6 order has a Communication tab with the request's thread", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    await openTab(page, "Communication");
    const entry = page.locator("li").filter({ hasText: CALL_BODY }).first();
    await expect(entry).toBeVisible();
    await expect(entry).toContainText("Phone · Incoming");
  });

  test("2.7 source request link goes back to the request", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText("Source request")).toBeVisible();
    const link = page.locator("aside").getByRole("link", { name: /^REQ-/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/requests/${requestId}$`));
  });
});

test.describe("3. Editing an order's transport", () => {
  test("3.1 edit form is prefilled from the copied legs and cargo", async ({ page }) => {
    await page.goto(`/orders/${orderId}/edit`);
    await expect(field(page, "Transport type").getByRole("combobox")).toHaveValue("Road");
    await expect(input(page, "Origin city")).toHaveValue("Istanbul");
    await expect(input(page, "Destination city")).toHaveValue("Baku");
    await expect(field(page, "Transport subtype").getByRole("combobox")).toHaveValue("FTL");
    await expect(input(page, "Cargo description")).toHaveValue(CARGO);
    // Numeric columns round-trip with their scale ("18000.00").
    await expect(input(page, "Gross weight (kg)")).toHaveValue(/^18000(\.00)?$/);
  });

  test("3.2 change destination city and weight, then save", async ({ page }) => {
    await page.goto(`/orders/${orderId}/edit`);
    await input(page, "Destination city").fill("Ganja");
    await input(page, "Gross weight (kg)").fill("21000");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForDetail(page, "orders");
  });

  test("3.3 detail shows the new values and the list row keeps its route", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    await expect(defValue(page, "Destination country")).toContainText("Ganja");
    await expect(defValue(page, "Gross weight (kg)")).toContainText("21000");

    // Search by number: the list is paginated and older runs push rows off page 1.
    await page.goto(`/orders?q=${await recordNumber(page)}`);
    const myRow = page.getByRole("row").filter({ has: page.locator(`a[href="/orders/${orderId}"]`) });
    await expect(myRow).toHaveCount(1);
    await expect(myRow).toContainText("→");
    await expect(myRow).toContainText(/Türkiye|Turkey/);
    await expect(myRow).toContainText("Azerbaijan");
  });

  /**
   * The plan's "seed one leg from the flat columns" branch is NOT reachable on
   * this database: all four leg-less orders (ORD-2026-005/007/010/013) have an
   * empty transport_type and empty from/to countries, so
   * `legacyLegDraft` (src/modules/orders/shipment-columns.ts:73) returns null.
   * Only the "seeds nothing and the form still loads" branch can be checked,
   * and it is checked read-only — saving would rewrite a pre-existing row's
   * delivery_format.
   */
  test("3.4 a leg-less legacy order opens for edit with no seeded leg", async ({ page }) => {
    await page.goto("/orders?q=ORD-2026-013");
    const legacy = page.getByRole("link", { name: "ORD-2026-013", exact: true });
    await expect(legacy).toBeVisible();
    const href = (await legacy.getAttribute("href"))!;

    await page.goto(`${href}/edit`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edit order");
    // No transport type, therefore no leg fields at all.
    await expect(field(page, "Transport type").getByRole("combobox")).toHaveValue("");
    await expect(field(page, "Origin country")).toHaveCount(0);
    // The flat cargo columns are still bridged into the cargo block.
    await expect(input(page, "Cargo description")).toHaveValue("Canned goods, dry");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  });

  test("3.5 create a sea/FCL order from scratch", async ({ page }) => {
    await page.goto("/orders/new");
    await setCombo(page, "Client", CLIENT);
    await input(page, "Order subject").fill(`E2E sea ${RUN}`);
    await setCombo(page, "Transport type", "Sea");
    await setCombo(page, "Transport subtype", "FCL");
    await setCombo(page, "Origin country", "China");
    await input(page, "Origin city").fill("Shanghai");
    await input(page, "Port of loading").fill("CNSHA");
    await setCombo(page, "Destination country", AZ);
    await input(page, "Destination city").fill("Baku");
    await input(page, "Port of discharge").fill("AZBAK");
    await setCombo(page, "Container type", "40' HC");
    await input(page, "Container quantity").fill("3");
    await input(page, "Cargo description").fill(SEA_CARGO);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const seaId = await waitForDetail(page, "orders");
    const number = await recordNumber(page);

    await expect(defValue(page, "Transport type")).toHaveText("Sea · FCL");
    await expect(defValue(page, "Port of loading")).toHaveText("CNSHA");
    await expect(defValue(page, "Port of discharge")).toHaveText("AZBAK");
    await expect(defValue(page, "Container type")).toHaveText("40' HC");
    await expect(defValue(page, "Container quantity")).toHaveText("3");
    await expect(defValue(page, "Cargo description")).toHaveText(SEA_CARGO);

    await page.goto(`/orders?q=${number}`);
    const myRow = page.getByRole("row").filter({ has: page.locator(`a[href="/orders/${seaId}"]`) });
    await expect(myRow).toContainText("China");
    await expect(myRow).toContainText("Azerbaijan");
    await expect(myRow).toContainText("Sea");
  });
});

test.describe("5.3 converted order regressions", () => {
  test("5.3 Finance and Documents tabs still render", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    await openTab(page, "Finance");
    await expect(page.getByText("Revenue").first()).toBeVisible();
    await openTab(page, "Documents");
    await expect(page.getByText("No documents yet").first()).toBeVisible();
  });
});
