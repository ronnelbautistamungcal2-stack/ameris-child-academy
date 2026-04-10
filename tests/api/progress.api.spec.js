// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const {
  loginAsAdmin,
  loginAsCoach,
  loginAsParent,
  loginAsTeacher,
} = require("../helpers/auth");
const { apiGet } = require("../helpers/api");

const prisma = new PrismaClient();

test.describe("Progress API @api", () => {
  /** @type {any} */
  let fixture = null;

  test.beforeAll(async () => {
    const suffix = Date.now();
    const [teacher, parent, coach] = await Promise.all([
      prisma.user.findUnique({ where: { email: "teacher@demo.com" } }),
      prisma.user.findUnique({ where: { email: "parent@demo.com" } }),
      prisma.user.findUnique({ where: { email: "coach@demo.com" } }),
    ]);

    if (!teacher || !parent || !coach) {
      throw new Error("Seed users are required for progress API tests");
    }

    const centerA = await prisma.center.create({
      data: {
        name: `QA Progress Center A ${suffix}`,
        address: "QA Street A",
      },
    });
    const centerB = await prisma.center.create({
      data: {
        name: `QA Progress Center B ${suffix}`,
        address: "QA Street B",
      },
    });

    await prisma.centerUser.createMany({
      data: [
        { userId: coach.id, centerId: centerA.id, role: "COACH" },
        { userId: teacher.id, centerId: centerA.id, role: "TEACHER" },
      ],
      skipDuplicates: true,
    });

    const [classA, classB] = await Promise.all([
      prisma.classRoom.create({
        data: { name: `QA Progress Class A ${suffix}`, centerId: centerA.id },
      }),
      prisma.classRoom.create({
        data: { name: `QA Progress Class B ${suffix}`, centerId: centerB.id },
      }),
    ]);

    await prisma.teacherClass.create({
      data: { teacherId: teacher.id, classId: classA.id },
    });

    const [categoryA, categoryB] = await Promise.all([
      prisma.lessonCategory.create({
        data: {
          centerId: centerA.id,
          name: `QA Progress Category A ${suffix}`,
        },
      }),
      prisma.lessonCategory.create({
        data: {
          centerId: centerB.id,
          name: `QA Progress Category B ${suffix}`,
        },
      }),
    ]);

    const [lessonA, lessonB] = await Promise.all([
      prisma.lesson.create({
        data: {
          centerId: centerA.id,
          categoryId: categoryA.id,
          title: `QA Progress Lesson A ${suffix}`,
          goals: {
            create: [{ goalIndex: 1, title: `QA Goal A ${suffix}` }],
          },
        },
      }),
      prisma.lesson.create({
        data: {
          centerId: centerB.id,
          categoryId: categoryB.id,
          title: `QA Progress Lesson B ${suffix}`,
          goals: {
            create: [{ goalIndex: 1, title: `QA Goal B ${suffix}` }],
          },
        },
      }),
    ]);

    const [parentChild, otherChildSameCenter, otherCenterChild] = await Promise.all([
      prisma.child.create({
        data: {
          centerId: centerA.id,
          classRoomId: classA.id,
          parentId: parent.id,
          firstName: "QA",
          lastName: `ParentChild ${suffix}`,
        },
      }),
      prisma.child.create({
        data: {
          centerId: centerA.id,
          classRoomId: classA.id,
          firstName: "QA",
          lastName: `OtherChild ${suffix}`,
        },
      }),
      prisma.child.create({
        data: {
          centerId: centerB.id,
          classRoomId: classB.id,
          firstName: "QA",
          lastName: `CenterBChild ${suffix}`,
        },
      }),
    ]);

    const [parentProgress, foreignProgress, otherCenterProgress] = await Promise.all([
      prisma.progress.create({
        data: {
          childId: parentChild.id,
          lessonId: lessonA.id,
          goalIndex: 1,
          status: "IN_PROGRESS",
        },
      }),
      prisma.progress.create({
        data: {
          childId: otherChildSameCenter.id,
          lessonId: lessonA.id,
          goalIndex: 1,
          status: "FAILED",
        },
      }),
      prisma.progress.create({
        data: {
          childId: otherCenterChild.id,
          lessonId: lessonB.id,
          goalIndex: 1,
          status: "IN_PROGRESS",
        },
      }),
    ]);

    fixture = {
      centerA,
      centerB,
      classA,
      classB,
      categoryA,
      categoryB,
      lessonA,
      lessonB,
      parentChild,
      otherChildSameCenter,
      otherCenterChild,
      parentProgress,
      foreignProgress,
      otherCenterProgress,
      teacherId: teacher.id,
      coachId: coach.id,
    };
  });

  test.afterAll(async () => {
    if (fixture) {
      await prisma.progress.deleteMany({
        where: {
          id: {
            in: [
              fixture.parentProgress.id,
              fixture.foreignProgress.id,
              fixture.otherCenterProgress.id,
            ],
          },
        },
      });
      await prisma.child.deleteMany({
        where: {
          id: {
            in: [
              fixture.parentChild.id,
              fixture.otherChildSameCenter.id,
              fixture.otherCenterChild.id,
            ],
          },
        },
      });
      await prisma.lesson.deleteMany({
        where: { id: { in: [fixture.lessonA.id, fixture.lessonB.id] } },
      });
      await prisma.lessonCategory.deleteMany({
        where: { id: { in: [fixture.categoryA.id, fixture.categoryB.id] } },
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
          userId: { in: [fixture.teacherId, fixture.coachId] },
          centerId: { in: [fixture.centerA.id, fixture.centerB.id] },
        },
      });
      await prisma.center.deleteMany({
        where: { id: { in: [fixture.centerA.id, fixture.centerB.id] } },
      });
    }

    await prisma.$disconnect();
  });

  test("GET /api/v1/progress filters admin results by centerId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(
      request,
      `/api/v1/progress?centerId=${fixture.centerA.id}`,
      cookies,
    );

    expect(res.status()).toBe(200);
    const data = await res.json();
    const returnedIds = new Set(data.map((row) => row.id));

    expect(returnedIds.has(fixture.parentProgress.id)).toBe(true);
    expect(returnedIds.has(fixture.foreignProgress.id)).toBe(true);
    expect(returnedIds.has(fixture.otherCenterProgress.id)).toBe(false);
  });

  test("GET /api/v1/progress/:id forbids parent from another child's progress", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(
      request,
      `/api/v1/progress/${fixture.foreignProgress.id}`,
      cookies,
    );

    expect(res.status()).toBe(403);
  });

  test("GET /api/v1/progress/:id forbids teacher outside assigned class", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(
      request,
      `/api/v1/progress/${fixture.otherCenterProgress.id}`,
      cookies,
    );

    expect(res.status()).toBe(403);
  });

  test("GET /api/v1/progress scopes coach access to assigned centers", async ({ request }) => {
    const cookies = await loginAsCoach(request);

    const [allRes, forbiddenRes] = await Promise.all([
      apiGet(request, "/api/v1/progress", cookies),
      apiGet(request, `/api/v1/progress?centerId=${fixture.centerB.id}`, cookies),
    ]);

    expect(allRes.status()).toBe(200);
    expect(forbiddenRes.status()).toBe(403);

    const allRows = await allRes.json();
    const returnedIds = new Set(allRows.map((row) => row.id));

    expect(returnedIds.has(fixture.parentProgress.id)).toBe(true);
    expect(returnedIds.has(fixture.otherCenterProgress.id)).toBe(false);
  });
});
