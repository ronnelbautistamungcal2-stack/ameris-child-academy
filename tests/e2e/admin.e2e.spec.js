const { test, expect } = require("@playwright/test");
const { loginAsAdmin, waitForLoadingDone } = require("../helpers/e2e");

test.describe("Admin Workflows", () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(page, request);
  });

  test("can navigate to children page", async ({ page }) => {
    await page.click("text=Children");
    await waitForLoadingDone(page);
    await expect(page.getByText("Children").first()).toBeVisible();
  });

  test("children page has search and filter", async ({ page }) => {
    await page.goto("/admin/children");
    await waitForLoadingDone(page);

    // Search input should be present
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    // Age filter should be present
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("can open add child modal", async ({ page }) => {
    await page.goto("/admin/children");
    await waitForLoadingDone(page);

    await page.click("text=Add Child");
    // Modal should be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByText("First Name")).toBeVisible();
  });

  test("can close modal with close button", async ({ page }) => {
    await page.goto("/admin/children");
    await waitForLoadingDone(page);

    await page.click("text=Add Child");
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.click("text=Close");
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("can navigate to curriculum page", async ({ page }) => {
    await page.goto("/admin/curriculum");
    await waitForLoadingDone(page);
    await expect(page.getByText(/curriculum|lessons/i).first()).toBeVisible();
  });

  test("sidebar navigation works with groups", async ({ page }) => {
    // Click a nav group if present
    const navGroup = page.locator("aside nav button").first();
    if (await navGroup.isVisible()) {
      await navGroup.click();
      // Should expand and show child items
      const childLink = page.locator("aside nav a").first();
      await expect(childLink).toBeVisible();
    }
  });

  test("theme toggle works", async ({ page }) => {
    const themeButton = page.locator('[aria-label="Toggle theme"]');
    await expect(themeButton).toBeVisible();
    await themeButton.click();

    // Should apply dark class to html or body
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);

    // Toggle back
    await themeButton.click();
    const isLight = await page.evaluate(() =>
      !document.documentElement.classList.contains("dark")
    );
    expect(isLight).toBe(true);
  });
});
