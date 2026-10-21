// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsCoach } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

// Center Performance on a throwaway center: one teacher, one classroom and a
// child with a citizenship grade, an assessed step and an open IPP.
test.describe("Center Performance Overview @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;
  let teacher;
  let childId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = (await (await apiPost(request, "/api/v1/centers", { name: `QA Center Perf ${Date.now()}` }, admin)).json()).id;
    const created = await apiPost(request, "/api/v1/users", { email: `perf-${Date.now()}@example.com`, name: "Perf Teacher", middleInitial: "P", password: "Password123!", roles: ["TEACHER"], centerId }, admin);
    expect(created.status(), await created.text()).toBeLessThan(300);
    teacher = await created.json();
    const classRoomId = (await (await apiPost(request, "/api/v1/classes", { centerId, name: "QA Preschool" }, admin)).json()).id;
    const born = new Date();
    born.setMonth(born.getMonth() - 20);
    childId = (await (await apiPost(request, "/api/v1/children", { centerId, classRoomId, firstName: "Perf", lastName: "Kid", birthDate: born.toISOString().slice(0, 10) }, admin)).json()).id;

    const cat = await (await apiPost(request, "/api/v1/lesson-categories", { centerId, name: "General" }, admin)).json();
    const walk = (await (await apiPost(request, "/api/v1/lessons", { centerId, isStep: true, title: "Walks", reference: "SP-1", categoryId: cat.id, ageYears: 1, ageMonths: 3 }, admin)).json()).id;
    await apiPut(request, `/api/v1/sop/${childId}`, { mode: "assessment", levels: [{ stepId: walk, level: "EXPOSURE" }], generate: true }, admin);
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    await apiPost(request, "/api/v1/activities", { childId, type: "OTHER", details: { kind: "DAILY_GRADE", grade: 9 }, createdAt: today.toISOString() }, admin);
    await apiPost(request, "/api/v1/activities", { childId, type: "BEHAVIOR", details: { behaviorType: "HONESTY", behaviorLevel: "2" }, createdAt: today.toISOString() }, admin);
    await apiPost(request, "/api/v1/ipp", { childId, startDate: "2026-09-01", reviewSchedule: "MONTHLY", status: "NEEDS_UPDATE", focusArea: "Behavior", goals: [{ title: "Gentle hands", domain: "Behavior" }] }, admin);
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (teacher?.id) await apiDelete(request, `/api/v1/users/${teacher.id}`, admin);
    if (centerId) await apiDelete(request, `/api/v1/centers/${centerId}`, admin);
  });

  test("returns a row per staff member and per child for the dates", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/reports/center-performance?centerId=${centerId}`, admin);
    expect(res.status(), await res.text()).toBe(200);
    const r = await res.json();
    expect(r.center.id).toBe(centerId);

    const row = r.staff.find((s) => s.id === teacher.id);
    expect(row).toMatchObject({ name: "Perf Teacher", role: "TEACHER", position: "Teacher", hoursScheduled: 0, commendations: 0, citations: 0 });
    expect(row).toHaveProperty("currentGrade");
    expect(row).toHaveProperty("priorGrade");

    expect(r.students).toEqual([
      expect.objectContaining({
        id: childId,
        teacher: "",
        citizenship: 9,
        // Walking was expected at 15 months; the child is about 20 and only at Exposure.
        milestones: "CRITICAL",
        levels: { EXPOSURE: 1, COMPETENCY: 0, MASTERY: 0 },
        ipp: "NOT_ON_TRACK",
      }),
    ]);
    expect(r.courseCorrections).toEqual([expect.objectContaining({ type: "HONESTY" })]);
  });

  test("only admins can open it", async ({ request }) => {
    expect((await apiGet(request, `/api/v1/reports/center-performance?centerId=${centerId}`, await loginAsTeacher(request))).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/reports/center-performance?centerId=${centerId}`, await loginAsCoach(request))).status()).toBe(403);
    const admin = await loginAsAdmin(request);
    expect((await apiGet(request, `/api/v1/reports/center-performance?centerId=${centerId}&from=2026-10-10&to=2026-10-01`, admin)).status()).toBe(400);
  });
});
