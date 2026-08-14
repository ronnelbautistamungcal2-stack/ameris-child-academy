const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();
const runId = `${Date.now()}`;
const fixture = {
  centerName: `QA Carpool Center ${runId}`,
  routeAName: `QA Route A ${runId}`,
  childRouteAName: `RouteAKid${runId}`,
  childRouteBName: `RouteBKid${runId}`,
  childUnassignedName: `NoCarpoolKid${runId}`,
};

async function prepareFixture() {
  const center = await prisma.center.create({
    data: { name: fixture.centerName, address: "QA Carpool Address" },
  });

  const childRouteA = await prisma.child.create({
    data: {
      firstName: fixture.childRouteAName,
      lastName: "Test",
      centerId: center.id,
      carpool: fixture.routeAName,
    },
  });

  const childRouteB = await prisma.child.create({
    data: {
      firstName: fixture.childRouteBName,
      lastName: "Test",
      centerId: center.id,
      carpool: `QA Route B ${runId}`,
    },
  });

  const childUnassigned = await prisma.child.create({
    data: {
      firstName: fixture.childUnassignedName,
      lastName: "Test",
      centerId: center.id,
    },
  });

  return { center, childRouteA, childRouteB, childUnassigned };
}

async function cleanupFixture() {
  const center = await prisma.center.findFirst({ where: { name: fixture.centerName } });
  if (!center) return;
  await prisma.child.deleteMany({ where: { centerId: center.id } });
  await prisma.center.delete({ where: { id: center.id } });
}

test.describe("Admin carpool report", () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupFixture();
    await prepareFixture();
    await loginAsAdmin(page, request);
  });

  test.afterAll(async () => {
    await cleanupFixture();
    await prisma.$disconnect();
  });

  test("groups children by carpool and separates unassigned children", async ({ page }) => {
    await page.goto("/admin/carpool-report");
    await waitForLoadingDone(page);

    await page.getByLabel("Center").selectOption({ label: fixture.centerName });

    const routeAHeading = page.getByRole("heading", { name: new RegExp(`^${fixture.routeAName}`) });
    await expect(routeAHeading).toBeVisible();
    const routeASection = routeAHeading.locator("xpath=ancestor::div[contains(@class,'break-inside-avoid')]");
    await expect(routeASection.getByText(fixture.childRouteAName)).toBeVisible();
    await expect(routeASection.getByText(fixture.childRouteBName)).toHaveCount(0);

    const unassignedHeading = page.getByRole("heading", { name: /^No Carpool Assigned/ });
    await expect(unassignedHeading).toBeVisible();
    const unassignedSection = unassignedHeading.locator("xpath=ancestor::div[contains(@class,'break-inside-avoid')]");
    await expect(unassignedSection.getByText(fixture.childUnassignedName)).toBeVisible();

    await expect(page.getByText(/2 of 3 children have a carpool assigned/)).toBeVisible();
  });
});
