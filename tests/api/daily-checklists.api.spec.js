// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
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
      data: {
        centerId: center.id,
        name: `QA Checklist Class ${suffix}`,
        ageRange: "3 years",
      },
    });

    const classRoomTwo = await prisma.classRoom.create({
      data: {
        centerId: center.id,
        name: `QA Checklist Class Two ${suffix}`,
        ageRange: "4-5 years",
      },
    });

    await prisma.teacherClass.create({
      data: { teacherId: teacher.id, classId: classRoom.id },
    });

    const category = await prisma.lessonCategory.create({
      data: {
        centerId: center.id,
        name: `QA Seasonal Lessons ${suffix}`,
        kind: "PACKAGE",
        ageRange: "3 years",
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
      classRoomTwo,
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
      await prisma.dailyChecklist.deleteMany({
        where: { centerId: fixture.center.id },
      });
      await prisma.lessonTermCalendar.deleteMany({
        where: { centerId: fixture.center.id },
      });
      await prisma.milestoneChecklistPlan.deleteMany({
        where: { centerId: fixture.center.id },
      });
      await prisma.lessonGoal.deleteMany({
        where: { lesson: { centerId: fixture.center.id } },
      });
      await prisma.lesson.deleteMany({ where: { centerId: fixture.center.id } });
      await prisma.lessonCategory.deleteMany({ where: { centerId: fixture.center.id } });
      await prisma.teacherClass.deleteMany({
        where: {
          teacherId: fixture.teacherId,
          classId: { in: [fixture.classRoom.id, fixture.classRoomTwo.id] },
        },
      });
      await prisma.classRoom.deleteMany({
        where: { id: { in: [fixture.classRoom.id, fixture.classRoomTwo.id] } },
      });
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

  test("admin can assign one checklist to multiple classrooms", async ({ request }) => {
    const adminCookies = await loginAsAdmin(request);
    const teacherCookies = await loginAsTeacher(request);

    const createRes = await apiPost(
      request,
      "/api/v1/daily-checklists",
      {
        centerId: fixture.center.id,
        title: `QA Multi-Class Checklist ${Date.now()}`,
        description: "One checklist shared across two classrooms",
        category: "OPENING",
        classRoomIds: [fixture.classRoom.id, fixture.classRoomTwo.id],
        items: [{ title: "Unlock classroom doors", frequency: "DAILY" }],
      },
      adminCookies,
    );

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.classRoomIds.sort()).toEqual(
      [fixture.classRoom.id, fixture.classRoomTwo.id].sort(),
    );
    expect(created.classRooms.map((room) => room.id).sort()).toEqual(
      [fixture.classRoom.id, fixture.classRoomTwo.id].sort(),
    );

    const teacherListRes = await apiGet(
      request,
      `/api/v1/daily-checklists?centerId=${fixture.center.id}&date=${fixture.today}`,
      teacherCookies,
    );

    expect(teacherListRes.status()).toBe(200);
    const teacherLists = await teacherListRes.json();
    const visibleChecklist = teacherLists.find((list) => list.id === created.id);
    expect(visibleChecklist).toBeTruthy();
    expect(visibleChecklist.classRoomIds.sort()).toEqual(
      [fixture.classRoom.id, fixture.classRoomTwo.id].sort(),
    );

    const filteredRes = await apiGet(
      request,
      `/api/v1/daily-checklists?centerId=${fixture.center.id}&classRoomId=${fixture.classRoom.id}&date=${fixture.today}`,
      teacherCookies,
    );

    expect(filteredRes.status()).toBe(200);
    const filteredLists = await filteredRes.json();
    expect(filteredLists.some((list) => list.id === created.id)).toBeTruthy();
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

  test("daily checklist auto-matches lessons by term day and slot", async ({ request }) => {
    const adminCookies = await loginAsAdmin(request);

    const monday = new Date();
    const dayOfWeek = monday.getDay();
    const daysUntilMonday = (8 - (dayOfWeek || 7)) % 7;
    monday.setDate(monday.getDate() + daysUntilMonday);
    monday.setHours(0, 0, 0, 0);

    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);

    const thursdayKey = dateKey(thursday);

    await prisma.lessonTermCalendar.create({
      data: {
        centerId: fixture.center.id,
        term: "Term 1",
        startDate: monday,
        endDate: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4),
      },
    });

    const alternateCategory = await prisma.lessonCategory.create({
      data: {
        centerId: fixture.center.id,
        name: `QA Alternate Lessons ${Date.now()}`,
        kind: "PACKAGE",
        ageRange: "3 years",
      },
    });

    const distractorLesson = await prisma.lesson.create({
      data: {
        centerId: fixture.center.id,
        categoryId: alternateCategory.id,
        title: `AAA Distractor Large Group Lesson ${Date.now()}`,
        description: "Competing slot match from another category",
        term: "Term 1",
        termDays: [4],
        lessonSlot: "Large Group 1",
        media: [],
      },
    });

    const autoLesson = await prisma.lesson.create({
      data: {
        centerId: fixture.center.id,
        categoryId: fixture.category.id,
        title: `QA Auto Large Group Lesson ${Date.now()}`,
        description: "Automatically matched lesson",
        term: "Term 1",
        termDays: [4],
        lessonSlot: "Large Group 1",
        media: [],
      },
    });

    const createRes = await apiPost(
      request,
      "/api/v1/daily-checklists",
      {
        centerId: fixture.center.id,
        title: `QA Auto Checklist ${Date.now()}`,
        description: "Auto lesson slot checklist",
        category: "CLASSROOM",
        classRoomIds: [fixture.classRoom.id],
        items: [
          {
            title: "Large group",
            frequency: "DAILY",
            lessonSource: "AUTO_SLOT",
            lessonSlot: "Large Group 1",
            lessonCategoryId: fixture.category.id,
          },
        ],
      },
      adminCookies,
    );

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.items[0].lessonSource).toBe("AUTO_SLOT");

    const listRes = await apiGet(
      request,
      `/api/v1/daily-checklists?centerId=${fixture.center.id}&classRoomId=${fixture.classRoom.id}&date=${thursdayKey}`,
      adminCookies,
    );

    expect(listRes.status()).toBe(200);
    const lists = await listRes.json();
    const checklist = lists.find((list) => list.id === created.id);
    expect(checklist).toBeTruthy();
    expect(checklist.lessonTermCalendar).toMatchObject({
      term: "Term 1",
      termDay: 4,
    });
    expect(checklist.items[0]).toMatchObject({
      lessonSource: "AUTO_SLOT",
      lessonSlot: "Large Group 1",
      lessonCategoryId: fixture.category.id,
    });
    expect(checklist.items[0].lesson?.id).toBe(autoLesson.id);
    expect(checklist.items[0].lesson?.id).not.toBe(distractorLesson.id);
  });
});
