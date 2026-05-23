// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiGet } = require("../helpers/api");

const prisma = new PrismaClient();

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

test.describe("Compliance API @api", () => {
  /** @type {null | {
   * centerId: string,
   * teacherClockedInId: string,
   * teacherNotClockedInId: string,
   * centerUserIds: string[],
   * attendanceId: string,
   * userIds: string[],
   * }} */
  let fixture = null;

  test.beforeAll(async () => {
    const suffix = Date.now();
    const center = await prisma.center.create({
      data: { name: `QA Compliance Center ${suffix}` },
    });

    const teacherClockedIn = await prisma.user.create({
      data: {
        email: `qa-compliance-clocked-${suffix}@demo.com`,
        name: `QA Compliance Clocked ${suffix}`,
        role: "TEACHER",
        roles: ["TEACHER"],
      },
    });

    const teacherNotClockedIn = await prisma.user.create({
      data: {
        email: `qa-compliance-unclocked-${suffix}@demo.com`,
        name: `QA Compliance Unclocked ${suffix}`,
        role: "TEACHER",
        roles: ["TEACHER"],
      },
    });

    const centerUserRows = await prisma.$transaction([
      prisma.centerUser.create({
        data: {
          userId: teacherClockedIn.id,
          centerId: center.id,
          role: "TEACHER",
        },
      }),
      prisma.centerUser.create({
        data: {
          userId: teacherNotClockedIn.id,
          centerId: center.id,
          role: "TEACHER",
        },
      }),
    ]);

    const attendance = await prisma.staffAttendance.create({
      data: {
        userId: teacherClockedIn.id,
        centerId: center.id,
        date: new Date(`${todayKey()}T00:00:00.000Z`),
        clockIn: new Date(`${todayKey()}T08:00:00.000Z`),
        status: "PRESENT",
      },
    });

    fixture = {
      centerId: center.id,
      teacherClockedInId: teacherClockedIn.id,
      teacherNotClockedInId: teacherNotClockedIn.id,
      centerUserIds: centerUserRows.map((row) => row.id),
      attendanceId: attendance.id,
      userIds: [teacherClockedIn.id, teacherNotClockedIn.id],
    };
  });

  test.afterAll(async () => {
    if (fixture) {
      await prisma.staffAttendance.deleteMany({
        where: { id: fixture.attendanceId },
      });
      await prisma.centerUser.deleteMany({
        where: { id: { in: fixture.centerUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: fixture.userIds } },
      });
      await prisma.center.deleteMany({
        where: { id: fixture.centerId },
      });
    }

    await prisma.$disconnect();
  });

  test("compliance logging only flags teachers clocked in today", async ({ request }) => {
    if (!fixture) test.skip();

    const cookies = await loginAsAdmin(request);

    const summaryRes = await apiGet(
      request,
      `/api/v1/compliance/summary?centerId=${fixture.centerId}`,
      cookies,
    );
    expect(summaryRes.status()).toBe(200);
    const summary = await summaryRes.json();
    expect(Array.isArray(summary.teachers)).toBe(true);
    expect(summary.teachers).toHaveLength(1);
    expect(summary.teachers[0].id).toBe(fixture.teacherClockedInId);
    expect(summary.teachers[0].logs.last24Hours).toBe(0);

    const checkRes = await apiGet(
      request,
      `/api/v1/compliance/check?centerId=${fixture.centerId}`,
      cookies,
    );
    expect(checkRes.status()).toBe(200);
    const check = await checkRes.json();
    expect(check.missedLogging.count).toBe(1);
    expect(check.missedLogging.teachers).toHaveLength(1);
    expect(check.missedLogging.teachers[0].id).toBe(fixture.teacherClockedInId);
    expect(
      check.missedLogging.teachers.some(
        (teacher) => teacher.id === fixture.teacherNotClockedInId,
      ),
    ).toBe(false);
  });
});
