// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiDelete, apiPost } = require("../helpers/api");
const { loginViaApi, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Phase 7b admin Compliance Alerts and Form Renewals pages.
test.describe("Compliance Alerts and Form Renewals pages", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let child;
  let template;
  const stamp = Date.now();

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Compliance UI ${stamp}` }, admin)).json();
    const res = await apiPost(request, "/api/v1/compliance/requirements", { centerId: center.id, name: `QA Fire Drill ${stamp}`, category: "Safety", frequency: "MONTHLY", nextDue: inDays(-1) }, admin);
    expect(res.status(), await res.text()).toBe(201);
    child = await prisma.child.create({ data: { firstName: "Tracker", lastName: `Kid${stamp}`, centerId: center.id } });
    template = await (await apiPost(request, "/api/v1/forms/templates", {
      title: `QA Physical Exam ${stamp}`, targetRole: "PARENT", assignmentType: "CHILD", active: true, requiresRenewal: true, renewalPeriodDays: 365, centerId: center.id,
    }, admin)).json();
  });

  test.afterAll(async ({ request }) => {
    await prisma.complianceRequirement.deleteMany({ where: { centerId: center?.id } });
    if (template?.id) {
      await prisma.formRenewalNote.deleteMany({ where: { templateId: template.id } });
      await prisma.formTemplate.delete({ where: { id: template.id } }).catch(() => {});
    }
    if (child) await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("admins add a requirement and check one off", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "admin@demo.com", "adminpass");
    await page.goto(`/admin/compliance-alerts?centerId=${center.id}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("heading", { name: "Compliance Alerts", level: 1 })).toBeVisible();

    const overdueRow = page.getByRole("row").filter({ hasText: `QA Fire Drill ${stamp}` });
    await expect(overdueRow).toContainText("Overdue");

    await page.getByRole("button", { name: "+ Add Requirement" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Requirement" });
    await dialog.getByPlaceholder("Enter requirement name...").fill(`QA Menu Review ${stamp}`);
    await dialog.getByRole("combobox").first().selectOption("Nutrition");
    await dialog.locator('input[type="date"]').fill(inDays(60));
    await dialog.getByLabel("Frequency").selectOption("QUARTERLY");
    await dialog.getByRole("button", { name: "Age Group(s)" }).click();
    await dialog.getByLabel("0-1 year").check();
    await dialog.getByRole("button", { name: "Age Group(s)" }).click();
    await expect(dialog.getByRole("button", { name: "Age Group(s)" })).toHaveText("0-1 year");
    await dialog.getByRole("button", { name: "Save Requirement" }).click();
    await expect(dialog).toHaveCount(0);
    const newRow = page.getByRole("row").filter({ hasText: `QA Menu Review ${stamp}` });
    await expect(newRow).toContainText("Quarterly");
    await expect(newRow).toContainText("Upcoming");

    await overdueRow.getByRole("checkbox").click();
    await expect(overdueRow.getByRole("checkbox")).toBeChecked();
    await expect(overdueRow).toContainText("Completed");
    await expect(overdueRow).toContainText("1/1");
  });

  test("Form Renewals lists each child's renewing form and saves a note", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "admin@demo.com", "adminpass");
    await page.goto(`/admin/form-renewals?centerId=${center.id}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("heading", { name: "Form Renewals", level: 1 })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: `Tracker Kid${stamp}` }).filter({ hasText: `QA Physical Exam ${stamp}` });
    await expect(row).toContainText("Overdue");
    await expect(row).toContainText("Not sent");
    await row.getByRole("textbox").fill("Called the family");
    await row.getByRole("textbox").blur();
    await expect.poll(async () => (await prisma.formRenewalNote.findFirst({ where: { templateId: template.id, childId: child.id } }))?.note).toBe("Called the family");
  });
});
