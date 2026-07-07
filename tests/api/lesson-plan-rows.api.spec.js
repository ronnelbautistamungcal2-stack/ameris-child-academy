// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();
const ROW_COUNT = 10;

test.describe("Lesson Plan Rows API @api", () => {
  let fixture = null;

  test.beforeAll(async () => {
    const suffix = Date.now();
    const teacher = await prisma.user.findUnique({
      where: { email: "teacher@demo.com" },
    });

    if (!teacher) {
      throw new Error("Seed teacher is required for lesson plan row API tests");
    }

    const center = await prisma.center.create({
      data: { name: `QA Lesson Plan Row Center ${suffix}`, address: "QA Street" },
    });

    await prisma.centerUser.create({
      data: { userId: teacher.id, centerId: center.id, role: "TEACHER" },
    });

    const classRoom = await prisma.classRoom.create({
      data: {
        centerId: center.id,
        name: `QA Lesson Plan Row Class ${suffix}`,
        ageRange: "3 years",
      },
    });

    await prisma.teacherClass.create({
      data: { teacherId: teacher.id, classId: classRoom.id },
    });

    fixture = { teacherId: teacher.id, center, classRoom };
  });

  test.afterAll(async () => {
    if (fixture) {
      await prisma.lessonPlanRow.deleteMany({ where: { centerId: fixture.center.id } });
      await prisma.teacherClass.deleteMany({
        where: { teacherId: fixture.teacherId, classId: fixture.classRoom.id },
      });
      await prisma.classRoom.deleteMany({ where: { id: fixture.classRoom.id } });
      await prisma.centerUser.deleteMany({
        where: { userId: fixture.teacherId, centerId: fixture.center.id },
      });
      await prisma.center.deleteMany({ where: { id: fixture.center.id } });
    }

    await prisma.$disconnect();
  });

  test("GET /api/v1/lesson-plan-rows returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/lesson-plan-rows");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/lesson-plan-rows returns 400 without centerId/classRoomId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/lesson-plan-rows", cookies);
    expect(res.status()).toBe(400);
  });

  test("GET /api/v1/lesson-plan-rows returns 403 for a role without classroom access", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(
      request,
      `/api/v1/lesson-plan-rows?centerId=${fixture.center.id}&classRoomId=${fixture.classRoom.id}`,
      cookies,
    );
    expect(res.status()).toBe(403);
  });

  test("GET /api/v1/lesson-plan-rows returns default rows for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(
      request,
      `/api/v1/lesson-plan-rows?centerId=${fixture.center.id}&classRoomId=${fixture.classRoom.id}`,
      cookies,
    );
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(ROW_COUNT);
    expect(rows.every((r) => r.id === null && r.label === "")).toBe(true);
    expect(rows.map((r) => r.rowIndex)).toEqual(Array.from({ length: ROW_COUNT }, (_, i) => i));
  });

  test("GET /api/v1/lesson-plan-rows returns 200 for a teacher assigned to the classroom", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(
      request,
      `/api/v1/lesson-plan-rows?centerId=${fixture.center.id}&classRoomId=${fixture.classRoom.id}`,
      cookies,
    );
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(ROW_COUNT);
  });

  test("PUT /api/v1/lesson-plan-rows returns 403 for a non-admin (teacher) even with classroom access", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiPut(
      request,
      "/api/v1/lesson-plan-rows",
      {
        centerId: fixture.center.id,
        classRoomId: fixture.classRoom.id,
        rowIndex: 0,
        label: "Attempted teacher edit",
      },
      cookies,
    );
    expect(res.status()).toBe(403);

    const verifyRes = await apiGet(
      request,
      `/api/v1/lesson-plan-rows?centerId=${fixture.center.id}&classRoomId=${fixture.classRoom.id}`,
      cookies,
    );
    const rows = await verifyRes.json();
    expect(rows[0].label).toBe("");
  });

  test("PUT /api/v1/lesson-plan-rows returns 400 for an out-of-range rowIndex", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPut(
      request,
      "/api/v1/lesson-plan-rows",
      {
        centerId: fixture.center.id,
        classRoomId: fixture.classRoom.id,
        rowIndex: ROW_COUNT,
        label: "Out of range",
      },
      cookies,
    );
    expect(res.status()).toBe(400);
  });

  test("PUT /api/v1/lesson-plan-rows upserts a row as admin (create then update)", async ({ request }) => {
    const cookies = await loginAsAdmin(request);

    const createRes = await apiPut(
      request,
      "/api/v1/lesson-plan-rows",
      {
        centerId: fixture.center.id,
        classRoomId: fixture.classRoom.id,
        rowIndex: 2,
        label: "Circle Time",
      },
      cookies,
    );
    expect(createRes.status()).toBe(200);
    const created = await createRes.json();
    expect(created.label).toBe("Circle Time");
    expect(created.rowIndex).toBe(2);

    const updateRes = await apiPut(
      request,
      "/api/v1/lesson-plan-rows",
      {
        centerId: fixture.center.id,
        classRoomId: fixture.classRoom.id,
        rowIndex: 2,
        label: "Circle Time (Updated)",
      },
      cookies,
    );
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.id).toBe(created.id);
    expect(updated.label).toBe("Circle Time (Updated)");

    const listRes = await apiGet(
      request,
      `/api/v1/lesson-plan-rows?centerId=${fixture.center.id}&classRoomId=${fixture.classRoom.id}`,
      cookies,
    );
    const rows = await listRes.json();
    expect(rows[2]).toMatchObject({ id: created.id, rowIndex: 2, label: "Circle Time (Updated)" });
    // Other rows remain untouched
    expect(rows[0].label).toBe("");
  });
});
