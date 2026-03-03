const { test, expect } = require("@playwright/test");
const { loginAsTeacher, waitForLoadingDone } = require("../helpers/e2e");

test.describe("Teacher Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
  });

  test("can navigate to children page", async ({ page }) => {
    await page.click("text=Children");
    await waitForLoadingDone(page);
    await expect(page).toHaveURL(/\/teacher\/children/);
  });

  test("can navigate to lessons page", async ({ page }) => {
    await page.goto("/teacher/lessons");
    await waitForLoadingDone(page);
    await expect(page.getByText(/lesson/i).first()).toBeVisible();
  });

  test("lessons page shows center selector", async ({ page }) => {
    await page.goto("/teacher/lessons");
    await waitForLoadingDone(page);
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("lessons page shows search when center selected", async ({ page }) => {
    await page.goto("/teacher/lessons");
    await waitForLoadingDone(page);

    // Select first center if available
    const select = page.locator("select").first();
    const options = await select.locator("option").all();
    if (options.length > 1) {
      await select.selectOption({ index: 1 });
      await waitForLoadingDone(page);
      await expect(page.locator('input[placeholder*="Lesson"]')).toBeVisible();
    }
  });

  test("can navigate to calendar page", async ({ page }) => {
    await page.goto("/teacher/calendar");
    await waitForLoadingDone(page);
    // Calendar page should load without errors
    await expect(page.locator("main")).toBeVisible();
  });

  test("notification bell is visible", async ({ page }) => {
    await expect(page.locator('[aria-label="Notifications"]')).toBeVisible();
  });

  test("can open notification dropdown", async ({ page }) => {
    await page.click('[aria-label="Notifications"]');
    await expect(page.locator('[role="menu"]')).toBeVisible();
  });

  test("can close notification dropdown with escape", async ({ page }) => {
    await page.click('[aria-label="Notifications"]');
    await expect(page.locator('[role="menu"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="menu"]')).not.toBeVisible();
  });
});
