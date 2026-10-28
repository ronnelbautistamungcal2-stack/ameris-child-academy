// @ts-check
const { test, expect } = require("@playwright/test");
const { loginViaApi, waitForLoadingDone } = require("../helpers/e2e");

// Phase 7a Reports (client mockup 15-01): report categories on the left, the
// report on the right, and Select Filter for children and staff.
test.describe("Reports hub", () => {
  test("admins pick a report from the categories and set the filter", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "admin@demo.com", "adminpass");
    await page.goto("/admin/reports/meal-claim");
    await waitForLoadingDone(page);
    const nav = page.getByRole("navigation", { name: "Report categories" });
    await expect(nav.getByRole("link", { name: /Meal Claim/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Meal Claim" }).first()).toBeVisible();

    await page.getByRole("button", { name: /Select Filter/ }).click();
    await page.getByLabel("All children").check();
    await page.getByLabel("All staff").check();
    await expect(page.getByRole("button", { name: /Select Filter/ })).toContainText("2");

    await page.getByRole("searchbox", { name: "Search reports" }).fill("milestone");
    await nav.getByRole("link", { name: /Milestone Progress Report/ }).click();
    await expect(page).toHaveURL(/\/admin\/reports\/milestone-progress/);
    await expect(page.getByRole("heading", { name: "Milestone Progress Report" }).first()).toBeVisible();
  });

  test("coaches get the same page with their reports", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "coach@demo.com", "coachpass");
    await page.goto("/coach/reports?report=meal-production");
    await waitForLoadingDone(page);
    await expect(page.getByRole("navigation", { name: "Report categories" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meal Production Record" }).first()).toBeVisible();
    await page.getByRole("link", { name: /Coaching Activity/ }).click();
    await expect(page).toHaveURL(/report=coaching-activity/);
  });
});
