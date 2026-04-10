const { test, expect } = require("@playwright/test");
const { loginAsParent, waitForLoadingDone } = require("../helpers/e2e");

test.describe("Parent Workflows", () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsParent(page, request);
  });

  test("can navigate to children page", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);
    await expect(page).toHaveURL(/\/parent\/children/);
    await expect(page.getByText("Switch child", { exact: true })).toBeVisible();
  });

  test("children page renders the parent report workspace", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    await expect(page.getByRole("heading", { name: "Switch child" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
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

  test("messages page keeps the conversation switcher visible on laptop widths", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/parent/messages");
    await waitForLoadingDone(page);
    await expect(page.getByRole("button", { name: "Conversations", exact: true })).toBeVisible();
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
    await page.waitForURL(/\/(login|api\/auth\/signout)/, { timeout: 10000 });
    if (/\/api\/auth\/signout/.test(page.url())) {
      await page.getByRole("button", { name: "Sign out" }).click();
    }
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
