import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("admin can log in, see Users nav, and log out", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@abode.com");
  await page.fill('input[name="password"]', "ChangeMe123!");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();

  await page.click('button:has-text("Sign out")');
  await expect(page).toHaveURL(/\/login/);
});
