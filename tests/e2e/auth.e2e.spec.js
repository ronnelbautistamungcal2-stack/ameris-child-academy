const { test, expect } = require("@playwright/test");
const { loginViaUI, loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/e2e");

test.describe("Authentication", () => {
  test("admin dashboard loads with a valid session", async ({ page, request }) => {
    await loginAsAdmin(page, request);
    await expect(page).toHaveURL(/\/(dashboard|admin)/);
    await expect(page.getByText("Sign Out")).toBeVisible();
  });

  test("teacher dashboard loads with a valid session", async ({ page, request }) => {
    await loginAsTeacher(page, request);
    await expect(page).toHaveURL(/\/(dashboard|teacher)/);
    await expect(page.getByText("Sign Out")).toBeVisible();
  });

  test("parent dashboard loads with a valid session", async ({ page, request }) => {
    await loginAsParent(page, request);
    await expect(page).toHaveURL(/\/(dashboard|parent)/);
    await expect(page.getByText("Sign Out")).toBeVisible();
  });

  test("invalid credentials keep the user on login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "bad@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // The login page should remain active after a failed attempt.
    await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("sign out redirects to login", async ({ page, request }) => {
    await loginAsAdmin(page, request);
    await page.click("text=Sign Out");
    await page.waitForURL(/\/(login|api\/auth\/signout)/, { timeout: 10000 });
    if (/\/api\/auth\/signout/.test(page.url())) {
      await page.getByRole("button", { name: "Sign out" }).click();
    }
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
