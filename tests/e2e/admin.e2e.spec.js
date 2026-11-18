const { test, expect } = require("@playwright/test");
const { loginAsAdmin, waitForLoadingDone } = require("../helpers/e2e");

test.describe("Admin Workflows", () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(page, request);
  });

  test("can navigate to children page", async ({ page }) => {
    await page.goto("/admin/children");
    await waitForLoadingDone(page);
    await expect(page).toHaveURL(/\/admin\/children/);
    // The page is the Student List now (client mockup, 10-29 requests).
    await expect(page.getByRole("heading", { name: "Student List" })).toBeVisible();
  });

  test("children page has search and filter", async ({ page }) => {
    await page.goto("/admin/children");
    await waitForLoadingDone(page);

    // Search input should be present
    await expect(page.getByLabel("Search student name")).toBeVisible();
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

  test("can close modal with cancel button", async ({ page }) => {
    await page.goto("/admin/children");
    await waitForLoadingDone(page);

    await page.getByRole("button", { name: /add child/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("can navigate to curriculum page", async ({ page }) => {
    await page.goto("/admin/curriculum");
    await waitForLoadingDone(page);
    // Ameris Academy edits its banks under Global admin now (client sheet 10-29 (9), rows 4/5).
    await expect(page.getByText("Edited in Global Admin")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Lesson Calendar" })).toBeVisible();
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
