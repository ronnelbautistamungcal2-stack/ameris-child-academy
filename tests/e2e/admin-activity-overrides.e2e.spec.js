const path = require("path");
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, waitForLoadingDone } = require("../helpers/e2e");

const PHOTO_PATH = path.resolve(__dirname, "../../public/icons/icon-192.png");

async function selectScope(page) {
  await page.goto("/admin/activity-overrides");
  await waitForLoadingDone(page);
  await expect(page.getByText("Admin Activity Log")).toBeVisible();
  const centerSelect = page.getByRole("combobox", { name: "Center", exact: true });
  const childSelect = page.getByRole("combobox", { name: "Child", exact: true });
  await expect(centerSelect).toBeEnabled();
  await centerSelect.selectOption({ label: "Demo Center" });
  await expect(childSelect).toBeEnabled();
  await childSelect.selectOption({ label: "Child One" });
  await expect(page.getByRole("button", { name: "Create Log" })).toBeVisible();
}

test.describe("Admin activity overrides", () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(page, request);
  });

  test("can create, edit, and delete a backdated assessment log with photos", async ({ page }) => {
    const note = `QA override ${Date.now()}`;
    const updatedNote = `${note} updated`;
    const createButton = page.getByRole("button", { name: "Create Log" });

    await selectScope(page);

    await page.route("**/api/v1/uploads", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const response = await route.fetch();
      await route.fulfill({ response });
    });

    const backdated = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pad = (value) => String(value).padStart(2, "0");
    const dateTime = `${backdated.getFullYear()}-${pad(backdated.getMonth() + 1)}-${pad(backdated.getDate())}T09:15`;

    await page.locator('input[type="datetime-local"]').first().fill(dateTime);
    await page.getByLabel("Description").fill(note);
    await page.getByRole("button", { name: /Developmental Assessment/i }).click();
    await page.getByRole("button", { name: "4 Advanced" }).first().click();
    await page.getByLabel("Activity photos").setInputFiles(PHOTO_PATH);

    await expect(page.getByText("Photos are still uploading. Save will unlock when the upload finishes.")).toBeVisible();
    await expect(createButton).toBeDisabled();
    await expect(createButton).toBeEnabled({ timeout: 10000 });

    await createButton.click();

    await expect(page.getByText(/created for Child One/i)).toBeVisible();

    const row = page.locator("tr").filter({ hasText: note }).first();
    await expect(row).toContainText("1 photo");

    await expect(page.getByRole("combobox", { name: "Filter Classroom" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Filter Child" })).toBeVisible();
    await expect(page.getByLabel("From Date")).toBeVisible();
    await expect(page.getByLabel("To Date")).toBeVisible();

    await page.getByLabel("Search Logs").fill(note);
    await expect(row).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();

    await row.getByRole("button", { name: "Edit" }).click();

    const editForm = page.locator("form").filter({ hasText: "Edit Activity Log" }).first();
    await editForm.getByLabel("Description").fill(updatedNote);
    await editForm.getByRole("button", { name: "2 Developing" }).first().click();
    await editForm.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("Activity log updated.")).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: updatedNote }).first()).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("tr").filter({ hasText: updatedNote }).first().getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Activity log deleted.")).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: updatedNote })).toHaveCount(0);
  });

  test("shows inline validation before saving invalid override data", async ({ page }) => {
    const createButton = page.getByRole("button", { name: "Create Log" });

    await selectScope(page);

    await page.getByRole("button", { name: "Nap" }).click();
    await page.getByLabel("Extra Details JSON").fill("[]");

    await expect(page.getByText("Extra details must be a JSON object.")).toBeVisible();
    await expect(createButton).toBeDisabled();

    await page.getByLabel("Extra Details JSON").fill("");
    await page.getByLabel("Start time").fill("11:00");
    await page.getByLabel("End time").fill("09:00");

    await expect(page.getByText("Nap end time must be after the start time.")).toBeVisible();
    await expect(createButton).toBeDisabled();

    await page.getByLabel("End time").fill("11:30");
    await expect(page.getByText("Nap end time must be after the start time.")).toHaveCount(0);
    await expect(createButton).toBeEnabled();
  });
});
