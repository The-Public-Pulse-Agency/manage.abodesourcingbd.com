import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@abode.com");
  await page.fill('input[name="password"]', "ChangeMe123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

test("create an order, add a size-wise line, and confirm it", async ({ page }) => {
  await login(page);

  // Create a draft PO
  const poNumber = `E2E-${Date.now()}`;
  await page.goto("/orders/new");
  await page.fill('input[name="poNumber"]', poNumber);
  await page.selectOption('select[name="buyerId"]', { label: "Ralawise" });
  await page.selectOption('select[name="brandId"]', { label: "TRIDRI" });
  await page.selectOption('select[name="factoryId"]', { index: 1 });
  await page.getByRole("button", { name: "Create draft order" }).click();

  await expect(page).toHaveURL(/\/orders\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: poNumber })).toBeVisible();
  await expect(page.getByText("DRAFT").first()).toBeVisible();

  // Add a size-wise line via the grid
  await page.getByLabel("Style").selectOption({ index: 1 });
  await page.getByLabel("Size scale").selectOption({ label: "Adult XS-2XL" });
  await page.getByLabel("qty M").fill("100");
  await page.getByLabel("net M").fill("1.50");
  await page.getByLabel("sell M").fill("2.00");
  await page.getByRole("button", { name: "Save line" }).click();
  await expect(page.getByText("Line saved")).toBeVisible();

  // The line + totals appear
  await expect(page.getByText("M·100")).toBeVisible();

  // Confirm the order
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText("lines are locked")).toBeVisible();
});
