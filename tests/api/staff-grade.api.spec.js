// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Staff Overall Grade weights set on the center (client request 2026-10-22).
test.describe("Staff Overall Grade weights @api", () => {
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

  test("weights must add up to 100 and are saved on the center", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const bad = await apiPut(request, `/api/v1/centers/${center.id}`, { staffGradeWeights: { evaluations: 50, checklist: 50, citations: 10, commendations: 0, hr: 0, citationPoints: 25, commendationPoints: 25 } }, admin);
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toMatch(/add up to 100/);

    const weights = { evaluations: 0, checklist: 0, citations: 50, commendations: 50, hr: 0, citationPoints: 20, commendationPoints: 40 };
    const ok = await apiPut(request, `/api/v1/centers/${center.id}`, { staffGradeWeights: weights }, admin);
    expect(ok.status(), await ok.text()).toBe(200);
    expect((await (await apiGet(request, `/api/v1/centers/${center.id}`, admin)).json()).staffGradeWeights).toEqual(weights);
  });

  test("the teacher report grades with the center's weights", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const today = new Date();
    await prisma.teacherCitation.create({ data: { teacherId: teacher.id, centerId: center.id, text: "Late to class", date: today } });
    await prisma.teacherCommendation.create({ data: { teacherId: teacher.id, centerId: center.id, text: "Great job", date: today } });
    const from = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const res = await apiGet(request, `/api/v1/analytics/teacher-perf-report?centerId=${center.id}&teacherId=${teacher.id}&from=${from}&to=${to}`, admin);
    expect(res.status(), await res.text()).toBe(200);
    const report = await res.json();
    // Citations 100 - 20 = 80, commendations 40; 50/50 -> 60.
    expect(report.gradeParts).toMatchObject({ citations: 80, commendations: 40, evaluations: null, hr: null });
    expect(report.overallGrade).toBe(60);
  });
});
