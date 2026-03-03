const { test, expect } = require("@playwright/test");
const { loginViaUI, loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/e2e");

test.describe("Authentication", () => {
  test("admin can log in and see dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/(dashboard|admin)/);
    await expect(page.getByText("Sign Out")).toBeVisible();
  });

  test("teacher can log in and see dashboard", async ({ page }) => {
    await loginAsTeacher(page);
    await expect(page).toHaveURL(/\/(dashboard|teacher)/);
    await expect(page.getByText("Sign Out")).toBeVisible();
  });

  test("parent can log in and see dashboard", async ({ page }) => {
    await loginAsParent(page);
    await expect(page).toHaveURL(/\/(dashboard|parent)/);
    await expect(page.getByText("Sign Out")).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "bad@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should stay on login page and show error
    await expect(page.locator(".bg-red-50, [class*='error'], [class*='red']").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test("sign out redirects to login", async ({ page }) => {
    await loginAsAdmin(page);
    await page.click("text=Sign Out");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
