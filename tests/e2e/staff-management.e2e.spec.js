const { test, expect } = require("@playwright/test");
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsTeacher, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();

function getMonday(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(current.getFullYear(), current.getMonth(), diff);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date) {
  return date.toISOString().split("T")[0];
}

function metricCard(page, label) {
  return page.getByText(label, { exact: true }).first().locator("..");
}

async function expectReportRow(row, { name, entries, hours, average }) {
  await expect(row.locator("td").nth(0)).toHaveText(name);
  await expect(row.locator("td").nth(1)).toHaveText(String(entries));
  await expect(row.locator("td").nth(2)).toHaveText(String(hours));
  await expect(row.locator("td").nth(3)).toHaveText(average);
}

async function getDemoContext() {
  const [center, admin, teacher, coach] = await Promise.all([
    prisma.center.findFirst({ where: { name: "Demo Center" } }),
    prisma.user.findUnique({ where: { email: "admin@demo.com" } }),
    prisma.user.findUnique({ where: { email: "teacher@demo.com" } }),
    prisma.user.findUnique({ where: { email: "coach@demo.com" } }),
  ]);

  if (!center || !admin || !teacher || !coach) {
    throw new Error("Demo seed data is missing. Run prisma seed before the browser QA suite.");
  }

  return { center, admin, teacher, coach };
}

test.describe("Staff management browser QA", () => {
  test.describe.configure({ mode: "serial" });

  let demo;

  test.beforeAll(async () => {
    demo = await getDemoContext();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("training reports respect filters and totals", async ({ page, request }) => {
    await prisma.trainingLog.deleteMany({
      where: {
        centerId: demo.center.id,
        topic: {
          startsWith: "[QA Training Report]",
        },
      },
    });

    await prisma.trainingLog.createMany({
      data: [
        {
          centerId: demo.center.id,
          userId: demo.teacher.id,
          recordedById: demo.admin.id,
          topic: "[QA Training Report] Classroom safety",
          description: "Teacher session",
          performedBy: "Admin User",
          hours: 2,
          date: new Date("2031-07-05T10:00:00.000Z"),
          category: "Safety",
        },
        {
          centerId: demo.center.id,
          userId: demo.teacher.id,
          recordedById: demo.admin.id,
          topic: "[QA Training Report] Curriculum deep dive",
          description: "Teacher follow-up",
          performedBy: "Admin User",
          hours: 1.5,
          date: new Date("2031-07-06T10:00:00.000Z"),
          category: "Curriculum",
        },
        {
          centerId: demo.center.id,
          userId: demo.coach.id,
          recordedById: demo.admin.id,
          topic: "[QA Training Report] Coaching lab",
          description: "Coach session",
          performedBy: "Admin User",
          hours: 3,
          date: new Date("2031-07-07T10:00:00.000Z"),
          category: "Professional Development",
        },
      ],
    });

    await loginAsAdmin(page, request);
    await page.goto("/admin/staff-management");
    await waitForLoadingDone(page);
    await page.locator("select").first().selectOption({ label: demo.center.name });
    await page.getByRole("button", { name: "Training" }).click();
    await expect(page.getByText("Employee Training Report")).toBeVisible();

    await page.getByLabel("From", { exact: true }).fill("2031-07-01");
    await page.getByLabel("To", { exact: true }).fill("2031-07-31");
    await page.getByRole("button", { name: "Run Report" }).click();

    const reportTable = page.locator("table").filter({
      has: page.getByRole("columnheader", { name: "Total Hours Completed" }),
    }).first();

    await expect(metricCard(page, "Total Hours")).toContainText("6.5");
    await expect(metricCard(page, "Entries")).toContainText("3");
    await expect(reportTable.locator("tbody tr")).toHaveCount(2);
    await expectReportRow(reportTable.locator("tbody tr").filter({ hasText: demo.teacher.name }), {
      name: demo.teacher.name,
      entries: 2,
      hours: 3.5,
      average: "1.75h",
    });
    await expectReportRow(reportTable.locator("tbody tr").filter({ hasText: demo.coach.name }), {
      name: demo.coach.name,
      entries: 1,
      hours: 3,
      average: "3h",
    });

    await page.getByLabel("Employee").selectOption({ label: demo.teacher.name });
    await page.getByRole("button", { name: "Run Report" }).click();

    await expect(metricCard(page, "Total Hours")).toContainText("3.5");
    await expect(metricCard(page, "Entries")).toContainText("2");
    await expect(page.getByText("This report is currently filtered to one employee.")).toBeVisible();
    await expect(reportTable.locator("tbody tr")).toHaveCount(1);
    await expectReportRow(reportTable.locator("tbody tr").first(), {
      name: demo.teacher.name,
      entries: 2,
      hours: 3.5,
      average: "1.75h",
    });
    await expect(reportTable).not.toContainText(demo.coach.name);
  });

  test("selected-staff shift copy only copies the chosen staff", async ({ page, request }) => {
    const currentWeekStart = getMonday();
    const previousWeekStart = addDays(currentWeekStart, -7);
    const currentWeekEnd = addDays(currentWeekStart, 6);

    await prisma.shiftSchedule.deleteMany({
      where: {
        centerId: demo.center.id,
        notes: {
          startsWith: "[QA Shift Copy]",
        },
        date: {
          gte: previousWeekStart,
          lte: currentWeekEnd,
        },
      },
    });

    await prisma.shiftSchedule.createMany({
      data: [
        {
          centerId: demo.center.id,
          userId: demo.teacher.id,
          date: previousWeekStart,
          startTime: "07:13",
          endTime: "11:47",
          position: "Teacher",
          notes: "[QA Shift Copy] Teacher previous week",
        },
        {
          centerId: demo.center.id,
          userId: demo.coach.id,
          date: previousWeekStart,
          startTime: "12:19",
          endTime: "16:33",
          position: "Coach",
          notes: "[QA Shift Copy] Coach previous week",
        },
      ],
    });

    await loginAsAdmin(page, request);
    await page.goto("/admin/shifts");
    await waitForLoadingDone(page);
    await page.locator("select").first().selectOption({ label: demo.center.name });

    const teacherRow = page.locator("tbody tr").filter({ hasText: demo.teacher.name });
    const coachRow = page.locator("tbody tr").filter({ hasText: demo.coach.name });

    await expect(page.getByRole("button", { name: "Copy all from previous week" })).toBeVisible();
    await teacherRow.locator('input[type="checkbox"]').check();
    await expect(page.getByText("1 staff selected for copy")).toBeVisible();
    await expect(page.getByText("Only the selected staff below will be copied from the previous week.")).toBeVisible();

    await page.getByRole("button", { name: "Copy selected staff (1)" }).click();
    await expect(page.getByText("Copied 1 shifts from the previous week for the selected staff")).toBeVisible();
    await expect(teacherRow).toContainText("07:13-11:47");
    await expect(coachRow).not.toContainText("12:19-16:33");

    const qaShifts = await prisma.shiftSchedule.findMany({
      where: {
        centerId: demo.center.id,
        notes: {
          startsWith: "[QA Shift Copy]",
        },
      },
      orderBy: [{ userId: "asc" }, { startTime: "asc" }],
    });
    const copiedShifts = qaShifts.filter((shift) => dateKey(shift.date) === dateKey(currentWeekStart));

    expect(copiedShifts).toHaveLength(1);
    expect(copiedShifts[0].userId).toBe(demo.teacher.id);
    expect(copiedShifts[0].startTime).toBe("07:13");
    expect(copiedShifts[0].endTime).toBe("11:47");
  });

  test("teacher evaluations only show submitted items and support acknowledgement", async ({ page, request }) => {
    await prisma.teacherEvaluation.deleteMany({
      where: {
        centerId: demo.center.id,
        teacherId: demo.teacher.id,
        period: {
          in: ["2031-09", "2031-10"],
        },
      },
    });

    await prisma.teacherEvaluation.create({
      data: {
        centerId: demo.center.id,
        teacherId: demo.teacher.id,
        evaluatorId: demo.admin.id,
        period: "2031-09",
        status: "DRAFT",
        overallScore: 72,
        categories: {
          "Classroom Management": 4,
          Communication: 3,
          "Curriculum Delivery": 4,
          "Child Engagement": 4,
          Professionalism: 3,
        },
        strengths: "Draft strengths",
        areasForImprovement: "Draft areas",
        goals: "Draft goals",
        notes: "[QA Evaluation Visibility] Draft only",
      },
    });

    const submittedEvaluation = await prisma.teacherEvaluation.create({
      data: {
        centerId: demo.center.id,
        teacherId: demo.teacher.id,
        evaluatorId: demo.admin.id,
        period: "2031-10",
        status: "SUBMITTED",
        overallScore: 88,
        categories: {
          "Classroom Management": 5,
          Communication: 4,
          "Curriculum Delivery": 4,
          "Child Engagement": 5,
          Professionalism: 4,
        },
        strengths: "Visible strengths",
        areasForImprovement: "Visible areas",
        goals: "Visible goals",
        notes: "[QA Evaluation Visibility] Submitted only",
      },
    });

    await loginAsTeacher(page, request);
    await page.goto("/teacher/training");
    await waitForLoadingDone(page);
    const centerSelect = page.getByLabel("Center");
    if (await centerSelect.isVisible().catch(() => false)) {
      await centerSelect.selectOption({ label: demo.center.name });
    }
    await page.getByRole("button", { name: "Evaluations" }).click();

    await expect(page.getByText("Submitted Evaluations")).toBeVisible();
    await expect(metricCard(page, "Visible Evaluations")).toContainText("1");
    await expect(metricCard(page, "Awaiting Acknowledgement")).toContainText("1");
    await expect(metricCard(page, "Acknowledged")).toContainText("0");
    await expect(page.getByText("2031-10")).toBeVisible();
    await expect(page.getByText("2031-09")).toHaveCount(0);
    await expect(page.getByText("Areas for Improvement")).toBeVisible();

    await page.getByRole("button", { name: "Acknowledge" }).click();

    await expect.poll(async () => {
      const refreshed = await prisma.teacherEvaluation.findUnique({
        where: { id: submittedEvaluation.id },
      });
      return refreshed?.status;
    }).toBe("ACKNOWLEDGED");

    const refreshedEvaluation = await prisma.teacherEvaluation.findUnique({
      where: { id: submittedEvaluation.id },
    });

    expect(refreshedEvaluation?.teacherAcknowledgedAt).toBeTruthy();
    await expect(metricCard(page, "Awaiting Acknowledgement")).toContainText("0");
    await expect(metricCard(page, "Acknowledged")).toContainText("1");
    await expect(page.getByText("Acknowledged")).toBeVisible();
    await expect(page.getByText("Pending")).toHaveCount(0);
  });
});
