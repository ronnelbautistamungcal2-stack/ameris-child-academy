// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiDelete, apiPost } = require("../helpers/api");
const { loginViaApi, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();

// Phase 7b Student Profile pages for admin, teacher and parent.
test.describe("Student profile pages", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let room;
  let teacher;
  let childId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Profile UI ${Date.now()}` }, admin)).json();
    teacher = await prisma.user.findUnique({ where: { email: "teacher@demo.com" } });
    const parent = await prisma.user.findUnique({ where: { email: "parent@demo.com" } });
    room = await prisma.classRoom.create({ data: { name: "Profile Room", centerId: center.id } });
    await prisma.centerUser.create({ data: { userId: teacher.id, centerId: center.id, role: "TEACHER" } });
    await prisma.teacherClass.create({ data: { teacherId: teacher.id, classId: room.id } });
    const child = await prisma.child.create({
      data: {
        firstName: "Ivy",
        lastName: "Profile",
        birthDate: new Date("2023-05-01T00:00:00Z"),
        centerId: center.id,
        classRoomId: room.id,
        parentId: parent.id,
        healthInfo: { allergies: ["Strawberries"] },
        allergies: "Strawberries",
      },
    });
    childId = child.id;
  });

  test.afterAll(async ({ request }) => {
    if (childId) await prisma.child.delete({ where: { id: childId } }).catch(() => {});
    await prisma.teacherClass.deleteMany({ where: { classId: room?.id } });
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("admins see Edit Profile with every tab", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "admin@demo.com", "adminpass");
    await page.goto(`/admin/children/${childId}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("heading", { name: "Student Profile" })).toBeVisible();
    await expect(page.getByText("Allergy - Strawberries")).toBeVisible();
    await page.getByRole("button", { name: /Edit Profile/ }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Child" });
    for (const name of ["Profile", "Schedule", "Contacts", "Health & Safety", "Documents", "Authorized Pickup", "Care Plan"]) {
      await expect(dialog.getByRole("tab", { name: new RegExp(name) })).toBeVisible();
    }
    await dialog.getByRole("tab", { name: /Care Plan/ }).click();
    await expect(dialog.getByText("Feeding Plan (Infants)")).toBeVisible();
  });

  test("teachers only view", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "teacher@demo.com", "teacherpass");
    await page.goto(`/teacher/children/${childId}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("link", { name: /Back to My Classroom/ })).toBeVisible();
    await expect(page.getByText("Allergy - Strawberries")).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit/ })).toHaveCount(0);
  });

  test("parents edit the family details in the Edit Child box", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "parent@demo.com", "parentpass");
    await page.goto(`/parent/children/${childId}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("heading", { name: "Child Profile" })).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Edit Child" });
    await expect(dialog.getByRole("tab")).toHaveCount(3);
    await dialog.getByRole("tab", { name: /Contacts/ }).click();
    await dialog.getByRole("textbox").first().fill("Pat Profile");
    await dialog.getByRole("button", { name: /Save/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Pat Profile")).toBeVisible();
  });
});
