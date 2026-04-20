// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

test.describe("Activities API @api", () => {
  /** @type {any} */
  let fixture = null;

  test.beforeAll(async () => {
    const suffix = Date.now();
    const teacher = await prisma.user.findUnique({
      where: { email: "teacher@demo.com" },
    });

    if (!teacher) {
      throw new Error("Seed teacher is required for activities API tests");
    }

    const center = await prisma.center.create({
      data: { name: `QA Activity Center ${suffix}`, address: "QA Street" },
    });

    await prisma.centerUser.create({
      data: { userId: teacher.id, centerId: center.id, role: "TEACHER" },
    });

    const classRoom = await prisma.classRoom.create({
      data: { centerId: center.id, name: `QA Activity Class ${suffix}` },
    });

    await prisma.teacherClass.create({
      data: { teacherId: teacher.id, classId: classRoom.id },
    });

    const child = await prisma.child.create({
      data: {
        centerId: center.id,
        classRoomId: classRoom.id,
        firstName: "QA",
        lastName: `ActivityChild ${suffix}`,
      },
    });

    fixture = {
      teacherId: teacher.id,
      center,
      classRoom,
      child,
    };
  });

  test.afterAll(async () => {
    if (fixture) {
      await prisma.activityLog.deleteMany({
        where: { childId: fixture.child.id },
      });
      await prisma.child.deleteMany({
        where: { id: fixture.child.id },
      });
      await prisma.teacherClass.deleteMany({
        where: {
          teacherId: fixture.teacherId,
          classId: fixture.classRoom.id,
        },
      });
      await prisma.classRoom.deleteMany({
        where: { id: fixture.classRoom.id },
      });
      await prisma.centerUser.deleteMany({
        where: {
          userId: fixture.teacherId,
          centerId: fixture.center.id,
        },
      });
      await prisma.center.deleteMany({
        where: { id: fixture.center.id },
      });
    }

    await prisma.$disconnect();
  });

  test("admin can create, update, and delete a backdated assessment activity", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const createRes = await apiPost(
      request,
      "/api/v1/activities",
      {
        childId: fixture.child.id,
        type: "OTHER",
        notes: "QA backdated assessment",
        createdAt,
        details: {
          kind: "DAILY_GRADE",
          grade: 5,
          domains: {
            cognitive: 4,
            social: 3,
          },
          domainAvg: 3.5,
          media: ["/uploads/qa-photo.png"],
        },
      },
      cookies,
    );

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.isBackdated).toBe(true);
    expect(created.details.kind).toBe("DAILY_GRADE");
    expect(created.details.media).toEqual(["/uploads/qa-photo.png"]);

    const updateRes = await apiPut(
      request,
      `/api/v1/activities/${created.id}`,
      {
        notes: "QA backdated assessment updated",
        details: {
          ...created.details,
          domains: {
            cognitive: 2,
            social: 4,
          },
          domainAvg: 3,
        },
      },
      cookies,
    );

    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.notes).toBe("QA backdated assessment updated");
    expect(updated.details.domains.cognitive).toBe(2);

    const deleteRes = await apiDelete(
      request,
      `/api/v1/activities/${created.id}`,
      cookies,
    );
    expect(deleteRes.status()).toBe(204);

    const getRes = await apiGet(
      request,
      `/api/v1/activities/${created.id}`,
      cookies,
    );
    expect(getRes.status()).toBe(404);
  });

  test("teacher cannot create a backdated activity log", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const backdated = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await apiPost(
      request,
      "/api/v1/activities",
      {
        childId: fixture.child.id,
        type: "MEAL",
        notes: "Teacher backdated test",
        createdAt: backdated,
        details: {
          time: "09:15",
          mealType: "LUNCH",
          quantity: "MOST",
        },
      },
      cookies,
    );

    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: "Teachers can set the activity time for today only",
    });
  });
});
