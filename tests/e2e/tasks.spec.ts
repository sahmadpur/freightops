import { expect, test, type Page } from "@playwright/test";
import { field, openTab, setCombo, uid, waitForDetail } from "./helpers";

const RUN = uid();
const CLIENT = "Silk Road Imports";
const TASK1 = `E2E overdue task ${RUN}`;
const TASK2 = `E2E future task ${RUN}`;
const TASK3 = `E2E order task ${RUN}`;

let requestId = "";
let orderId = "";
let assignee = "";

const taskList = (page: Page) => page.locator("ul:has(> li input[aria-label='Mark done'])");
const taskRow = (page: Page, title: string) =>
  page.locator("li").filter({ hasText: title }).first();

async function addTask(
  page: Page,
  title: string,
  opts: { type?: string; due?: string; assignee?: string } = {},
) {
  await page.locator("#taskTitle").fill(title);
  if (opts.type) await page.locator("#taskType").selectOption(opts.type);
  if (opts.due) await page.locator("#taskDue").fill(opts.due);
  if (opts.assignee) await setCombo(page, "Assignee", opts.assignee);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(taskRow(page, title)).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("4. Tasks tab", () => {
  test("4.0 set up a request and its order", async ({ page }) => {
    await page.goto("/requests/new");
    await setCombo(page, "Client", CLIENT);
    await page.getByRole("button", { name: "Save draft" }).click();
    requestId = await waitForDetail(page, "requests");

    await page.getByRole("button", { name: "Create order", exact: true }).click();
    await page.getByLabel("Create order").selectOption("direct");
    await page.getByRole("button", { name: "Create order", exact: true }).click();
    orderId = await waitForDetail(page, "orders");
  });

  test("4.1 request has a Tasks tab and it starts empty", async ({ page }) => {
    await page.goto(`/requests/${requestId}`);
    await openTab(page, "Tasks");
    await expect(page.getByText("No tasks yet.")).toBeVisible();
  });

  test("4.2 add a call task with a past due date and an assignee", async ({ page }) => {
    await page.goto(`/requests/${requestId}?tab=tasks`);
    // Whatever staff member the assignee picker offers first.
    const box = field(page, "Assignee").getByRole("combobox");
    await box.click();
    assignee = (await field(page, "Assignee").getByRole("option").first().innerText()).trim();
    await box.press("Escape");

    await addTask(page, TASK1, { type: "call", due: "2026-01-05", assignee });

    const row = taskRow(page, TASK1);
    await expect(row).toContainText("Call");
    await expect(row).toContainText(assignee);
    await expect(row).toContainText("due 2026-01-05");
    // Overdue is rendered in the danger colour.
    await expect(row.locator("span", { hasText: "due 2026-01-05" }).last()).toHaveClass(/danger-fg/);
  });

  test("4.3 ticking the checkbox strikes the task through, unticking restores it", async ({ page }) => {
    await page.goto(`/requests/${requestId}?tab=tasks`);
    const row = taskRow(page, TASK1);
    // click(), not check(): the box is controlled and only flips once the
    // server action has run and router.refresh() has landed.
    await row.getByRole("checkbox").click();
    await expect(row.getByRole("checkbox")).toBeChecked();
    await expect(row.locator("div", { hasText: TASK1 }).last()).toHaveClass(/line-through/);
    await row.getByRole("checkbox").click();
    await expect(row.getByRole("checkbox")).not.toBeChecked();
    await expect(row.locator("div", { hasText: TASK1 }).last()).not.toHaveClass(/line-through/);
  });

  test("4.4 ordering is open-first, then by due date", async ({ page }) => {
    await page.goto(`/requests/${requestId}?tab=tasks`);
    await addTask(page, TASK2, { type: "follow_up", due: "2026-12-31" });
    await expect(taskRow(page, TASK2)).not.toContainText(assignee);

    // Both open: earlier due date first.
    await expect(taskList(page).locator("> li")).toHaveText([
      new RegExp(TASK1),
      new RegExp(TASK2),
    ]);

    // Done sorts below open regardless of date.
    await taskRow(page, TASK1).getByRole("checkbox").click();
    await expect(taskList(page).locator("> li")).toHaveText([
      new RegExp(TASK2),
      new RegExp(TASK1),
    ]);
    await taskRow(page, TASK1).getByRole("checkbox").click();
    await expect(taskRow(page, TASK1).getByRole("checkbox")).not.toBeChecked();
  });

  test("4.5 the × button deletes a task", async ({ page }) => {
    await page.goto(`/requests/${requestId}?tab=tasks`);
    await taskRow(page, TASK2).getByRole("button", { name: "Remove" }).click();
    await expect(taskRow(page, TASK2)).toHaveCount(0);
    await page.reload();
    await openTab(page, "Tasks");
    await expect(page.getByText(TASK2)).toHaveCount(0);
    await expect(page.getByText(TASK1)).toBeVisible();
  });

  test("4.6 History records the task events", async ({ page }) => {
    await page.goto(`/requests/${requestId}?tab=history`);
    const history = page.getByRole("list").filter({ hasText: "added a task" }).first();
    await expect(history).toContainText("added a task");
    await expect(history).toContainText("completed a task");
    await expect(history).toContainText("removed a task");
  });

  test("4.7 order has its own Tasks tab, separate from the request's", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    await openTab(page, "Tasks");
    await expect(page.getByText("No tasks yet.")).toBeVisible();
    await addTask(page, TASK3, { type: "booking" });
    await expect(taskRow(page, TASK3)).toContainText("Booking");

    await page.goto(`/requests/${requestId}?tab=tasks`);
    await expect(page.getByText(TASK3)).toHaveCount(0);
    await expect(page.getByText(TASK1)).toBeVisible();
  });
});
