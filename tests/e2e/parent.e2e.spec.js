const { test, expect } = require("@playwright/test");
const { loginAsParent, waitForLoadingDone } = require("../helpers/e2e");

test.describe("Parent Workflows", () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsParent(page, request);
  });

  test("can navigate to children page", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);
    await expect(page.getByText("My Children")).toBeVisible();
  });

  test("children page shows child list or empty state", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    // Either children buttons or empty state should be visible
    const hasChildren = await page.locator("button", { hasText: /View details|Selected/ }).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/No children found/).isVisible().catch(() => false);
    expect(hasChildren || hasEmpty).toBe(true);
  });

  test("tab navigation shows correct roles", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    // Check for tab list with proper ARIA role
    const tablist = page.locator('[role="tablist"]');
    if (await tablist.isVisible()) {
      const tabs = await tablist.locator('[role="tab"]').all();
      expect(tabs.length).toBeGreaterThan(0);

      // First tab should be selected
      const firstTab = tabs[0];
      await expect(firstTab).toHaveAttribute("aria-selected", "true");
    }
  });

  test("can switch tabs", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    const tablist = page.locator('[role="tablist"]');
    if (await tablist.isVisible()) {
      const tabs = await tablist.locator('[role="tab"]').all();
      if (tabs.length >= 2) {
        // Click second tab
        await tabs[1].click();
        await expect(tabs[1]).toHaveAttribute("aria-selected", "true");
        await expect(tabs[0]).toHaveAttribute("aria-selected", "false");
      }
    }
  });

  test("can navigate to permissions page", async ({ page }) => {
    await page.goto("/parent/permissions");
    await waitForLoadingDone(page);
    await expect(page.locator("main")).toBeVisible();
  });

  test("can navigate to messages page", async ({ page }) => {
    await page.goto("/parent/messages");
    await waitForLoadingDone(page);
    await expect(page.locator("main")).toBeVisible();
  });

  test("billing request opens prefilled compose flow", async ({ page }) => {
    await page.goto("/parent/billing");
    await waitForLoadingDone(page);

    await page.getByRole("link", { name: "Request payment link" }).first().click();

    await expect(page).toHaveURL(/\/parent\/messages/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "New Conversation" })).toBeVisible();
    await expect(
      page.locator('input[placeholder="e.g. Regarding attendance..."]'),
    ).toHaveValue("Billing support request");
    await expect(
      page.locator('textarea[placeholder="Type your message..."]'),
    ).toHaveValue(/billing/i);
  });

  test("sign out works from parent portal", async ({ page }) => {
    await page.click("text=Sign Out");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
