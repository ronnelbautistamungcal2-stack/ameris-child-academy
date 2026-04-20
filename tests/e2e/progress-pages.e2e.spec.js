const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsTeacher, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();

test.describe("Progress page filter behavior", () => {
  test.describe.configure({ timeout: 120000 });

  /** @type {any} */
  let fixture = null;

  test.beforeAll(async () => {
    const suffix = Date.now();
    const teacher = await prisma.user.findUnique({
      where: { email: "teacher@demo.com" },
    });

    if (!teacher) {
      throw new Error("Seed teacher is required for progress page tests");
    }

    const [centerA, centerB] = await Promise.all([
      prisma.center.create({
        data: { name: `QA Progress UI Center A ${suffix}`, address: "QA Street A" },
      }),
      prisma.center.create({
        data: { name: `QA Progress UI Center B ${suffix}`, address: "QA Street B" },
      }),
    ]);

    await prisma.centerUser.createMany({
      data: [
        { userId: teacher.id, centerId: centerA.id, role: "TEACHER" },
        { userId: teacher.id, centerId: centerB.id, role: "TEACHER" },
      ],
      skipDuplicates: true,
    });

    const [classA, classB] = await Promise.all([
      prisma.classRoom.create({
        data: { centerId: centerA.id, name: `QA Progress UI Class A ${suffix}` },
      }),
      prisma.classRoom.create({
        data: { centerId: centerB.id, name: `QA Progress UI Class B ${suffix}` },
      }),
    ]);

    await prisma.teacherClass.createMany({
      data: [
        { teacherId: teacher.id, classId: classA.id },
        { teacherId: teacher.id, classId: classB.id },
      ],
      skipDuplicates: true,
    });

    const [childA, childB] = await Promise.all([
      prisma.child.create({
        data: {
          centerId: centerA.id,
          classRoomId: classA.id,
          firstName: "QA",
          lastName: `AdminSwitchA ${suffix}`,
        },
      }),
      prisma.child.create({
        data: {
          centerId: centerB.id,
          classRoomId: classB.id,
          firstName: "QA",
          lastName: `AdminSwitchB ${suffix}`,
        },
      }),
    ]);

    fixture = { teacherId: teacher.id, centerA, centerB, classA, classB, childA, childB };
  });

  test.afterAll(async () => {
    if (fixture) {
      await prisma.child.deleteMany({
        where: { id: { in: [fixture.childA.id, fixture.childB.id] } },
      });
      await prisma.teacherClass.deleteMany({
        where: {
          teacherId: fixture.teacherId,
          classId: { in: [fixture.classA.id, fixture.classB.id] },
        },
      });
      await prisma.classRoom.deleteMany({
        where: { id: { in: [fixture.classA.id, fixture.classB.id] } },
      });
      await prisma.centerUser.deleteMany({
        where: {
          userId: fixture.teacherId,
          centerId: { in: [fixture.centerA.id, fixture.centerB.id] },
        },
      });
      await prisma.center.deleteMany({
        where: { id: { in: [fixture.centerA.id, fixture.centerB.id] } },
      });
    }

    await prisma.$disconnect();
  });

  test("admin resets class and child selections when switching centers", async ({ page, request }) => {
    await loginAsAdmin(page, request);
    await page.goto("/admin/progress");
    await waitForLoadingDone(page);
    await expect(page.getByRole("heading", { name: "Progression Tracking" })).toBeVisible();

    const centerSelect = page.getByRole("combobox").nth(0);
    const classSelect = page.getByRole("combobox").nth(1);
    const childSelect = page.getByRole("combobox").nth(3);

    await centerSelect.selectOption(fixture.centerA.id);
    await classSelect.selectOption(fixture.classA.id);
    await childSelect.selectOption(fixture.childA.id);

    await expect(classSelect).toHaveValue(fixture.classA.id);
    await expect(childSelect).toHaveValue(fixture.childA.id);

    await centerSelect.selectOption(fixture.centerB.id);

    await expect(classSelect).toHaveValue("");
    await expect(childSelect).toHaveValue("");
  });

  test("teacher shows center guidance before selection and also resets stale scope", async ({ page, request }) => {
    await loginAsTeacher(page, request);
    await page.goto("/teacher/progress");
    await waitForLoadingDone(page);
    await expect(page.getByRole("heading", { name: "Progression Tracking" })).toBeVisible();

    await expect(page.getByText("Select a center to get started")).toBeVisible();

    const centerSelect = page.getByRole("combobox").nth(0);
    const classSelect = page.getByRole("combobox").nth(1);
    const childSelect = page.getByRole("combobox").nth(3);

    await centerSelect.selectOption(fixture.centerA.id);
    await classSelect.selectOption(fixture.classA.id);
    await childSelect.selectOption(fixture.childA.id);

    await expect(classSelect).toHaveValue(fixture.classA.id);
    await expect(childSelect).toHaveValue(fixture.childA.id);

    await centerSelect.selectOption(fixture.centerB.id);

    await expect(classSelect).toHaveValue("");
    await expect(childSelect).toHaveValue("");
  });
});
