const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const runId = `${Date.now()}`;
const fixture = {
  teacherName: `QA Teachers User ${runId}`,
  teacherEmail: `qa-teachers-${runId}@demo.com`,
  centerAName: `QA Teachers Center A ${runId}`,
  centerBName: `QA Teachers Center B ${runId}`,
  classAName: `QA Teachers Class A ${runId}`,
  classBName: `QA Teachers Class B ${runId}`,
};

async function loginAsAdminFast(page, request) {
  const csrfRes = await request.get("/api/auth/csrf");
  const csrfData = await csrfRes.json();

  await request.post("/api/auth/callback/credentials?json=true", {
    form: {
      csrfToken: csrfData.csrfToken,
      email: "admin@demo.com",
      password: "adminpass",
      callbackUrl: `${baseURL}/dashboard`,
    },
    failOnStatusCode: false,
    maxRedirects: 0,
  });

  const storageState = await request.storageState();
  const sessionCookie = (storageState.cookies || []).find((cookie) =>
    /(?:__Secure-)?next-auth\.session-token/.test(cookie.name),
  );

  if (!sessionCookie) {
    throw new Error("Unable to authenticate admin user for teachers page tests");
  }

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionCookie.value,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function getFixtureTeacher() {
  return prisma.user.upsert({
    where: { email: fixture.teacherEmail },
    update: {
      name: fixture.teacherName,
      password: "fixture-password",
      role: "TEACHER",
      roles: [],
    },
    create: {
      email: fixture.teacherEmail,
      name: fixture.teacherName,
      password: "fixture-password",
      role: "TEACHER",
      roles: [],
    },
  });
}

async function prepareFixture() {
  const teacher = await getFixtureTeacher();

  let centerA = await prisma.center.findFirst({
    where: { name: fixture.centerAName },
  });
  if (!centerA) {
    centerA = await prisma.center.create({
      data: { name: fixture.centerAName, address: "QA Address A" },
    });
  }

  let centerB = await prisma.center.findFirst({
    where: { name: fixture.centerBName },
  });
  if (!centerB) {
    centerB = await prisma.center.create({
      data: { name: fixture.centerBName, address: "QA Address B" },
    });
  }

  let classA = await prisma.classRoom.findFirst({
    where: { centerId: centerA.id, name: fixture.classAName },
  });
  if (!classA) {
    classA = await prisma.classRoom.create({
      data: { centerId: centerA.id, name: fixture.classAName },
    });
  }

  let classB = await prisma.classRoom.findFirst({
    where: { centerId: centerB.id, name: fixture.classBName },
  });
  if (!classB) {
    classB = await prisma.classRoom.create({
      data: { centerId: centerB.id, name: fixture.classBName },
    });
  }

  await prisma.centerUser.upsert({
    where: {
      userId_centerId: { userId: teacher.id, centerId: centerA.id },
    },
    update: { role: "TEACHER" },
    create: { userId: teacher.id, centerId: centerA.id, role: "TEACHER" },
  });

  await prisma.centerUser.upsert({
    where: {
      userId_centerId: { userId: teacher.id, centerId: centerB.id },
    },
    update: { role: "TEACHER" },
    create: { userId: teacher.id, centerId: centerB.id, role: "TEACHER" },
  });

  const existingClassAssignments = await prisma.teacherClass.findMany({
    where: {
      teacherId: teacher.id,
      classId: { in: [classA.id, classB.id] },
    },
    select: { classId: true },
  });
  const existingClassIds = new Set(existingClassAssignments.map((row) => row.classId));

  const missingClassIds = [classA.id, classB.id].filter((id) => !existingClassIds.has(id));
  if (missingClassIds.length) {
    await prisma.teacherClass.createMany({
      data: missingClassIds.map((classId) => ({ teacherId: teacher.id, classId })),
      skipDuplicates: true,
    });
  }

  return { teacher, centerA, centerB, classA, classB };
}

async function cleanupFixture() {
  const teacher = await prisma.user.findUnique({
    where: { email: fixture.teacherEmail },
  });
  const centers = await prisma.center.findMany({
    where: { name: { in: [fixture.centerAName, fixture.centerBName] } },
    select: { id: true },
  });
  const centerIds = centers.map((center) => center.id);

  const classes = await prisma.classRoom.findMany({
    where: { name: { in: [fixture.classAName, fixture.classBName] } },
    select: { id: true },
  });
  const classIds = classes.map((klass) => klass.id);

  if (teacher && classIds.length) {
    await prisma.teacherClass.deleteMany({
      where: {
        teacherId: teacher.id,
        classId: { in: classIds },
      },
    });
  }

  if (teacher && centerIds.length) {
    await prisma.centerUser.deleteMany({
      where: {
        userId: teacher.id,
        centerId: { in: centerIds },
        role: "TEACHER",
      },
    });
  }

  if (classIds.length) {
    await prisma.classRoom.deleteMany({
      where: { id: { in: classIds } },
    });
  }

  if (centerIds.length) {
    await prisma.center.deleteMany({
      where: { id: { in: centerIds } },
    });
  }

  if (teacher) {
    await prisma.user.delete({
      where: { id: teacher.id },
    });
  }
}

async function getTeacherFromApi(request, teacherId) {
  const response = await request.get("/api/v1/teachers");
  expect(response.ok()).toBeTruthy();
  const teachers = await response.json();
  return teachers.find((teacher) => teacher.id === teacherId);
}

test.describe.serial("Admin Teachers Page", () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareFixture();
    await loginAsAdminFast(page, request);
  });

  test.afterAll(async () => {
    await cleanupFixture();
    await prisma.$disconnect();
  });

  test("supports search and teacher profile navigation", async ({ page }) => {
    const { teacher } = await prepareFixture();

    await page.goto("/admin/teachers");

    await expect(
      page.getByText("Click a teacher to manage their assignments."),
    ).toBeVisible();

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill(fixture.teacherName.toLowerCase());
    await expect(page.getByText(fixture.teacherName).first()).toBeVisible();

    await page.getByRole("button", { name: fixture.teacherName }).click();
    await expect(page.getByText(fixture.teacherEmail).first()).toBeVisible();

    await page.getByRole("link", { name: /View Profile/i }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/teachers/${teacher.id}$`));
  });

  test("removes out-of-scope classrooms when center assignments change", async ({ page, request }) => {
    const { teacher, centerA, centerB, classA, classB } = await prepareFixture();

    await page.goto("/admin/teachers");
    await expect(
      page.getByText("Click a teacher to manage their assignments."),
    ).toBeVisible();

    await page.getByRole("button", { name: fixture.teacherName }).click();
    await expect(
      page.getByRole("button", {
        name: fixture.centerBName,
        exact: true,
        pressed: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fixture.classBName,
        exact: true,
        pressed: true,
      }),
    ).toBeVisible();

    await page.getByRole("button", {
      name: fixture.centerBName,
      exact: true,
      pressed: true,
    }).click();
    await expect(
      page.getByRole("button", {
        name: fixture.centerBName,
        exact: true,
        pressed: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: fixture.classBName, exact: true }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Save Assignments" }).click();
    await expect(
      page.getByText("Assignments saved successfully!"),
    ).toBeVisible();

    const updatedTeacher = await getTeacherFromApi(request, teacher.id);
    const updatedCenterIds = (updatedTeacher.centers || [])
      .filter((centerUser) => centerUser.role === "TEACHER")
      .map((centerUser) => centerUser.centerId);
    const updatedClassIds = (updatedTeacher.teacherClasses || []).map(
      (assignment) => assignment.classId,
    );

    expect(updatedCenterIds).not.toContain(centerB.id);
    expect(updatedClassIds).not.toContain(classB.id);

    await page.getByRole("button", {
      name: fixture.centerAName,
      exact: true,
      pressed: true,
    }).click();
    await expect(
      page.getByText("Select at least one center to choose classrooms."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: fixture.classAName, exact: true }),
    ).toHaveCount(0);

  });
});
