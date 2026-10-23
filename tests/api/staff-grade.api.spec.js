// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Staff Overall Grade weights and the pay schedule, set on the center (client
// requests 2026-10-22/23).
test.describe("Staff grade weights and pay schedule @api", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let teacher;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Grade ${Date.now()}` }, admin)).json();
    const res = await apiPost(request, "/api/v1/users", { email: `grade-${Date.now()}@example.com`, name: "Grade Teacher", middleInitial: "G", password: "Password123!", roles: ["TEACHER"], centerId: center.id }, admin);
    teacher = await res.json();
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (teacher?.id) await apiDelete(request, `/api/v1/users/${teacher.id}`, admin);
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, admin);
    await prisma.$disconnect();
  });

  test("evaluations, checklist and HR must add up to 100; settings are saved on the center", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const bad = await apiPut(request, `/api/v1/centers/${center.id}`, { staffGradeWeights: { evaluations: 50, checklist: 40, hr: 20, citationPct: 5, commendationPct: 5 } }, admin);
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toMatch(/add up to 100/);
    const badPay = await apiPut(request, `/api/v1/centers/${center.id}`, { payPeriodSettings: { type: "BIWEEKLY" } }, admin);
    expect(badPay.status()).toBe(400);

    const weights = { evaluations: 0, checklist: 0, hr: 100, citationPct: 10, commendationPct: 5 };
    const ok = await apiPut(request, `/api/v1/centers/${center.id}`, { staffGradeWeights: weights, payPeriodSettings: { type: "SEMI_MONTHLY" } }, admin);
    expect(ok.status(), await ok.text()).toBe(200);
    const saved = await (await apiGet(request, `/api/v1/centers/${center.id}`, admin)).json();
    expect(saved.staffGradeWeights).toEqual(weights);
    expect(saved.payPeriodSettings).toEqual({ type: "SEMI_MONTHLY" });
  });

  test("citations take a % off and commendations add a % to the overall grade", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const today = new Date();
    const at = (h) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h);
    // Worked 6 of 8 scheduled hours -> HR 75%.
    await prisma.shiftSchedule.create({ data: { userId: teacher.id, centerId: center.id, date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())), startTime: "08:00", endTime: "16:00" } });
    await prisma.staffAttendance.create({ data: { userId: teacher.id, centerId: center.id, date: at(0), clockIn: at(8), clockOut: at(14) } });
    await prisma.teacherCitation.create({ data: { teacherId: teacher.id, centerId: center.id, text: "Late to class", date: today } });
    for (const text of ["Great job", "Helped a colleague", "Clean room"]) {
      await prisma.teacherCommendation.create({ data: { teacherId: teacher.id, centerId: center.id, text, date: today } });
    }
    const from = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const res = await apiGet(request, `/api/v1/analytics/teacher-perf-report?centerId=${center.id}&teacherId=${teacher.id}&from=${from}&to=${to}`, admin);
    expect(res.status(), await res.text()).toBe(200);
    const report = await res.json();
    expect(report.gradeParts).toMatchObject({ hr: 75, evaluations: null });
    expect(report.gradeAdjustments).toEqual({ citations: -10, commendations: 15 });
    // 75 - 10 + 15
    expect(report.overallGrade).toBe(80);
  });
});
