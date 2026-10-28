// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach } = require("../helpers/auth");
const { apiDelete, apiPost } = require("../helpers/api");
const { loginViaApi, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();

// Phase 7b Billing pages: coach Parent Fees, admin Billing, parent invoice.
test.describe("Billing pages", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let child;
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Billing UI ${Date.now()}` }, admin)).json();
    const [coach, parent] = await Promise.all(["coach@demo.com", "parent@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })));
    await prisma.centerUser.create({ data: { userId: coach.id, centerId: center.id, role: "COACH" } });
    child = await prisma.child.create({ data: { firstName: "Emma", lastName: "Billing", centerId: center.id, parentId: parent.id } });
    const res = await apiPost(request, "/api/v1/billing/charges", {
      centerId: center.id, parentId: parent.id, date: dateKey, rows: [{ childId: child.id, description: "QA School Shirt", amount: 10 }],
    }, await loginAsCoach(request));
    expect(res.status(), await res.text()).toBe(201);
  });

  test.afterAll(async ({ request }) => {
    if (child) await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("coaches see Parent Fees and open Add Charge", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "coach@demo.com", "coachpass");
    await page.goto(`/coach/parent-fees?centerId=${center.id}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("cell", { name: "QA School Shirt", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "+ Add Charge" }).click();
    await expect(page.getByRole("dialog", { name: "Add Charge" })).toBeVisible();
  });

  test("admins open a family's invoice from Billing", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "admin@demo.com", "adminpass");
    await page.goto(`/admin/billing?centerId=${center.id}`);
    await waitForLoadingDone(page);
    await page.getByRole("button", { name: /Invoices for/ }).first().click();
    await page.getByRole("button", { name: /^INV-/ }).first().click();
    const invoice = page.getByRole("dialog", { name: "Invoice" });
    await expect(invoice.getByText("QA School Shirt")).toBeVisible();
    await expect(invoice.getByRole("button", { name: /Print/ })).toBeVisible();
  });

  test("parents view the invoice from their Billing page", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "parent@demo.com", "parentpass");
    await page.goto("/parent/billing");
    await waitForLoadingDone(page);
    await page.getByRole("button", { name: "View" }).first().click();
    await expect(page.getByRole("dialog", { name: "Invoice" }).getByText("TOTAL AMOUNT DUE")).toBeVisible();
  });
});
