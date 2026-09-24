const { test, expect } = require("@playwright/test");
const { loginAsAdmin, waitForLoadingDone } = require("../helpers/e2e");
const { loginAsAdmin: adminCookies } = require("../helpers/auth");
const { apiGet, apiDelete } = require("../helpers/api");

test.describe("Admin Form Library", () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(page, request);
    await page.goto("/admin/form-renewals");
    await waitForLoadingDone(page);
  });

  test("form renewals page offers a renewals and a form library view", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Form Renewals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Renewals", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Form Library", exact: true })).toBeVisible();
  });

  test("the form library exposes every assignment target", async ({ page }) => {
    await page.getByRole("button", { name: "Form Library", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Form Library" })).toBeVisible();

    await page.getByRole("button", { name: "Add Form" }).click();
    await expect(page.getByText("Assign this form to")).toBeVisible();

    for (const target of ["Family", "Child", "Age Group", "Staff"]) {
      await expect(
        page.locator("button").filter({ hasText: new RegExp(`^${target}`) }).first(),
      ).toBeVisible();
    }
  });

  test("choosing age group reveals the range inputs and staff reveals roles", async ({ page }) => {
    await page.getByRole("button", { name: "Form Library", exact: true }).click();
    await page.getByRole("button", { name: "Add Form" }).click();

    await page.locator("button").filter({ hasText: /^Age Group/ }).first().click();
    await expect(page.getByText("Age range")).toBeVisible();
    await expect(page.getByText("From", { exact: true })).toBeVisible();

    await page.locator("button").filter({ hasText: /^Staff/ }).first().click();
    await expect(page.getByText("Staff roles")).toBeVisible();
    await expect(page.getByRole("button", { name: "Teachers" })).toBeVisible();
  });

  test("a form assigned to an age group is created and listed", async ({ page, request }) => {
    const title = `E2E Age Group Form ${Date.now()}`;

    await page.getByRole("button", { name: "Form Library", exact: true }).click();
    await page.getByRole("button", { name: "Add Form" }).click();

    await page.getByPlaceholder("e.g. Health Information Form").fill(title);
    await page.locator("button").filter({ hasText: /^Age Group/ }).first().click();

    // "From" is the first year/month pair, "To" the second.
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("2");
    await numberInputs.nth(2).fill("5");

    await page.getByRole("button", { name: "Add form", exact: true }).click();

    await expect(page.getByText(`${title} added to the form library.`)).toBeVisible();

    // The innermost element holding both proves the range landed on this form's card,
    // without depending on how many other E2E forms are in the library.
    const card = page
      .locator("div")
      .filter({ hasText: title })
      .filter({ hasText: "Age Group · 2y – 5y" })
      .last();
    await expect(card).toBeVisible();

    // Leave the library as we found it.
    const cookies = await adminCookies(request);
    const list = await (await apiGet(request, "/api/v1/forms/templates", cookies)).json();
    const created = list.find((t) => t.title === title);
    if (created) await apiDelete(request, `/api/v1/forms/templates/${created.id}`, cookies);
  });
});
