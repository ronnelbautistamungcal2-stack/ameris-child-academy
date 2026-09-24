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
    await expect(page.getByRole("heading", { name: "My Children" })).toBeVisible();
  });

  test("children page renders the student performance report", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    await expect(page.getByRole("heading", { name: "My Children" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Student Performance Report" })).toBeVisible();
  });

  test("child switcher stays reachable after the page scrolls", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    const chips = page.locator('[data-child-chip-active]');
    await expect(chips.first()).toBeVisible();

    const headerHeight = await page.evaluate(
      () =>
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--app-header-h"),
        ) || 0,
    );

    // The report panel keeps loading rows in after the page settles, so the
    // page is still growing under us. Scroll again on each poll until the
    // switcher has pinned itself under the app header.
    await expect
      .poll(async () => {
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight),
        );
        const box = await chips.first().boundingBox();
        return box ? box.y : Number.POSITIVE_INFINITY;
      })
      .toBeLessThan(headerHeight + 80);

    const chipBox = await chips.first().boundingBox();
    expect(chipBox.y).toBeGreaterThanOrEqual(headerHeight - 1);

    // A second child is selectable from where the reader already is; no
    // scrolling back to the top first. (The page can still settle to a new
    // height afterwards, since the next child's report is its own length.)
    if ((await chips.count()) > 1) {
      await chips.nth(1).click();
      await expect(chips.nth(1)).toHaveAttribute("data-child-chip-active", "true");
    }
  });

  test("a parent can edit the child snapshot and see it on the card", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    const note = `Loves helping with younger children ${Date.now()}`;

    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Favorite Activities").fill("Art, Reading, Outdoor Play");
    await dialog.getByLabel("Strengths").fill("Kind, Helpful, Creative");
    await dialog.getByLabel("Areas of Focus").fill("Following multi-step directions");
    await dialog.getByLabel("Notes", { exact: true }).fill(note);
    await dialog.getByRole("button", { name: "Save snapshot" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(note)).toBeVisible();

    // The snapshot is stored, not just held in the page's state.
    await page.reload();
    await waitForLoadingDone(page);
    await expect(page.getByText(note)).toBeVisible();
  });

  test("view profile opens the child profile and saves the about section", async ({ page }) => {
    await page.goto("/parent/children");
    await waitForLoadingDone(page);

    await page.getByRole("link", { name: "View Profile" }).click();
    await expect(page).toHaveURL(/\/parent\/children\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "Child Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Family Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Classroom Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Emergency Contacts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Red Flags" })).toBeVisible();

    const summary = `A bright and curious learner ${Date.now()}`;
    await page.getByRole("button", { name: /^Edit About / }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Summary").fill(summary);
    await dialog.getByLabel("Languages").fill("English");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(summary)).toBeVisible();

    await page.reload();
    await waitForLoadingDone(page);
    await expect(page.getByText(summary)).toBeVisible();

    await page.getByRole("link", { name: "Back to Children" }).click();
    await expect(page.getByRole("heading", { name: "My Children" })).toBeVisible();
  });

  test("forms & renewals lists required forms and no permissions tab", async ({ page }) => {
    await page.goto("/parent/forms");
    await waitForLoadingDone(page);

    await expect(page.getByRole("heading", { name: "Forms & Renewals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Required Forms" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select a Child or Family" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Permissions", exact: true })).toHaveCount(0);
  });

  test("a required form can be filled in and sent from the table", async ({ page }) => {
    await page.goto("/parent/forms");
    await waitForLoadingDone(page);

    const start = page.getByRole("button", { name: "Start", exact: true }).first();
    // Clicks that land before the dev build finishes hydrating are swallowed.
    await expect(async () => {
      await start.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 45000 });

    await page.getByRole("dialog").getByRole("button", { name: "Submit form" }).click();
    await expect(page.getByText("sent to the center.")).toBeVisible();
  });

  test("forms & renewals keeps the submission history reachable", async ({ page }) => {
    await page.goto("/parent/forms");
    await waitForLoadingDone(page);

    await page.getByRole("button", { name: "Submission History" }).click();
    await expect(page.getByRole("heading", { name: "Submission timeline" })).toBeVisible();
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

    // Make a Payment follows whatever hosted route the center configured, so the
    // autopay link is the control that always routes back into the compose flow.
    // A click that lands before the dev build finishes hydrating is swallowed and
    // the route never changes, so retry until the navigation actually happens.
    const requestLink = page
      .getByRole("link", { name: "Enroll in AutoPay", exact: true })
      .first();
    await expect(async () => {
      await requestLink.click();
      await expect(page).toHaveURL(/\/parent\/messages/, { timeout: 5000 });
    }).toPass({ timeout: 45000 });
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
