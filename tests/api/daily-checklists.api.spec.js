// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost } = require("../helpers/api");

const prisma = new PrismaClient();

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

test.describe("Daily Checklists API @api", () => {
  let fixture = null;

  test.beforeAll(async () => {
    const suffix = Date.now();
    const teacher = await prisma.user.findUnique({
      where: { email: "teacher@demo.com" },
    });

    if (!teacher) {
      throw new Error("Seed teacher is required for daily checklist API tests");
    }

    const today = dateKey(new Date());
    const center = await prisma.center.create({
      data: { name: `QA Checklist Center ${suffix}`, address: "QA Street" },
    });

    await prisma.centerUser.create({
      data: { userId: teacher.id, centerId: center.id, role: "TEACHER" },
    });

    const classRoom = await prisma.classRoom.create({
      data: { centerId: center.id, name: `QA Checklist Class ${suffix}` },
    });

    await prisma.teacherClass.create({
      data: { teacherId: teacher.id, classId: classRoom.id },
    });

    const category = await prisma.lessonCategory.create({
      data: {
        centerId: center.id,
        name: `QA Seasonal Lessons ${suffix}`,
        kind: "PACKAGE",
        ageRange: "3-5",
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        centerId: center.id,
        categoryId: category.id,
        title: `QA Fall Week Lesson ${suffix}`,
        description: "Scheduled lesson for daily checklist merge",
        media: [],
      },
    });

    const goal = await prisma.lessonGoal.create({
      data: {
        lessonId: lesson.id,
        goalIndex: 1,
        title: "Letter B introduction",
        description: "Introduce the weekly letter lesson",
        passingCriteria: {
          lessonAttachment: "/uploads/qa-letter-b.pdf",
        },
      },
    });

    const plan = await prisma.milestoneChecklistPlan.create({
      data: {
        centerId: center.id,
        title: "Fall Week 3",
        period: "DAY",
        periodStart: new Date(`${today}T00:00:00.000Z`),
        items: {
          create: {
            title: "Letter B introduction",
            kind: "LESSON",
            lessonId: lesson.id,
            lessonGoalId: goal.id,
            sortOrder: 0,
          },
        },
      },
      include: { items: true },
    });

    fixture = {
      teacherId: teacher.id,
      center,
      classRoom,
      category,
      lesson,
      goal,
      plan,
      item: plan.items[0],
      today,
    };
  });

  test.afterAll(async () => {
    if (fixture) {
      await prisma.milestoneChecklistPlan.deleteMany({
        where: { id: fixture.plan.id },
      });
      await prisma.lessonGoal.deleteMany({ where: { id: fixture.goal.id } });
      await prisma.lesson.deleteMany({ where: { id: fixture.lesson.id } });
      await prisma.lessonCategory.deleteMany({ where: { id: fixture.category.id } });
      await prisma.teacherClass.deleteMany({
        where: {
          teacherId: fixture.teacherId,
          classId: fixture.classRoom.id,
        },
      });
      await prisma.classRoom.deleteMany({ where: { id: fixture.classRoom.id } });
      await prisma.centerUser.deleteMany({
        where: {
          userId: fixture.teacherId,
          centerId: fixture.center.id,
        },
      });
      await prisma.center.deleteMany({ where: { id: fixture.center.id } });
    }

    await prisma.$disconnect();
  });

  test("teacher daily checklist includes and completes scheduled lesson items", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const listRes = await apiGet(
      request,
      `/api/v1/daily-checklists?centerId=${fixture.center.id}&date=${fixture.today}`,
      cookies,
    );

    expect(listRes.status()).toBe(200);
    const lists = await listRes.json();
    const scheduled = lists.find((list) => list.source === "SCHEDULED_LESSON_PLAN");
    expect(scheduled).toBeTruthy();
    expect(scheduled.title).toBe("Fall Week 3");
    expect(scheduled.items).toHaveLength(1);
    expect(scheduled.items[0]).toMatchObject({
      id: fixture.item.id,
      source: "SCHEDULED_LESSON",
      title: "Letter B introduction",
    });

    const completeRes = await apiPost(
      request,
      "/api/v1/daily-checklists/complete",
      {
        itemId: fixture.item.id,
        source: "SCHEDULED_LESSON",
        date: fixture.today,
      },
      cookies,
    );

    expect(completeRes.status()).toBe(200);
    const completion = await completeRes.json();
    expect(completion.itemId).toBe(fixture.item.id);
    expect(completion.completedBy.email).toBe("teacher@demo.com");

    const completedListRes = await apiGet(
      request,
      `/api/v1/daily-checklists?centerId=${fixture.center.id}&date=${fixture.today}`,
      cookies,
    );
    expect(completedListRes.status()).toBe(200);
    const completedLists = await completedListRes.json();
    const completedScheduled = completedLists.find(
      (list) => list.source === "SCHEDULED_LESSON_PLAN",
    );
    expect(completedScheduled.items[0].completions).toHaveLength(1);
  });
});
