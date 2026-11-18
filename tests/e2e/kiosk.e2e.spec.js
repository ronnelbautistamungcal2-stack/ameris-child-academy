// @ts-check
// Kiosk (client sheet 10-29 (9), rows 8/9): a staff member who also has
// children here clocks in and stays on their screen, then signs several
// children in by tapping each child's Sign In and then Sign In Selected,
// without going back to the PIN page.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, pickDemoCenterId } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();

function randomPin() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

test.describe("Kiosk sign-in flow", () => {
  test.describe.configure({ mode: "serial" });
  let centerId = "";
  let user = null;
  let deviceId = "";
  let pin = "";
  const childIds = [];

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = pickDemoCenterId(await (await apiGet(request, "/api/v1/centers", admin)).json());
    const created = await apiPost(
      request,
      "/api/v1/users",
      { email: `kiosk-e2e-${stamp}@example.com`, name: "Kiosk Parent Staff", middleInitial: "E", password: "password123", roles: ["TEACHER"], centerId },
      admin,
    );
    expect(created.status()).toBe(201);
    user = await created.json();
    for (const firstName of ["Ava", "Ben"]) {
      const child = await prisma.child.create({ data: { firstName: `${firstName}${stamp}`, lastName: "Kiosk", centerId, parentId: user.id } });
      childIds.push(child.id);
    }
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    await prisma.attendanceSession.deleteMany({ where: { attendance: { childId: { in: childIds } } } });
    await prisma.attendance.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
    if (user?.id) await apiDelete(request, `/api/v1/users/${user.id}`, admin);
    if (deviceId) await apiDelete(request, `/api/v1/kiosk/devices?id=${deviceId}`, admin);
    await prisma.$disconnect();
  });

  test("staff clock in, stay on their screen, and sign two children in at once", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Enroll this browser as the center's kiosk (the device cookie lands in the page's context).
    const admin = await loginAsAdmin(request);
    const enroll = await page.context().request.post("/api/v1/kiosk/devices", { headers: { Cookie: admin }, data: { centerId, name: "QA e2e kiosk" } });
    expect(enroll.status()).toBe(201);
    deviceId = (await enroll.json()).id;
    // A PIN for the staff member, registered at this kiosk with their code.
    const { code } = await (await apiPost(request, `/api/v1/users/${user.id}/pin-reset`, {}, admin)).json();
    const kiosk = page.context().request;
    expect((await kiosk.post("/api/v1/kiosk/register/check", { data: { code } })).status()).toBe(200);
    for (let i = 0; i < 5 && !pin; i += 1) {
      const candidate = randomPin();
      const done = await kiosk.post("/api/v1/kiosk/register/complete", { data: { code, pin: candidate } });
      if (done.status() === 200) pin = candidate;
    }
    expect(pin).toBeTruthy();

    await page.goto("/kiosk");
    await expect(page.getByText("Enter your PIN")).toBeVisible();
    await page.keyboard.type(pin);
    await page.getByRole("button", { name: /Enter/ }).click();

    // Staff with children here choose Employee first.
    await page.getByRole("button", { name: /Employee/ }).click();
    await page.getByRole("button", { name: /Clock In/ }).click();
    // Row 9: they stay on their screen instead of going to the done/PIN page.
    await expect(page.getByRole("status")).toContainText("Clocked In");
    await expect(page.getByText("Currently Clocked In")).toBeVisible();
    await page.getByRole("button", { name: /Sign My Children In \/ Out/ }).click();

    // Row 8: tap each child's Sign In, then Sign In Selected.
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    for (const name of [`Ava${stamp}`, `Ben${stamp}`]) {
      const button = page.getByRole("button", { name: `Sign In ${name}` });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
    }
    // Tapping again un-picks; tap once more to pick again.
    const ava = page.getByRole("button", { name: `Sign In Ava${stamp}` });
    await ava.click();
    await expect(ava).toHaveAttribute("aria-pressed", "false");
    await ava.click();
    await page.getByRole("button", { name: "Sign In Selected" }).click();
    await expect(page.getByText("successfully signed in")).toBeVisible();

    const rows = await prisma.attendance.findMany({ where: { childId: { in: childIds } } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.checkedInAt && !r.checkedOutAt)).toBe(true);
    const staffDay = await prisma.staffAttendance.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } });
    expect(staffDay?.clockIn).toBeTruthy();
  });
});
