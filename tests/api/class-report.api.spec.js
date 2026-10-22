// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

// Class Performance Report on a throwaway center with one classroom and two children.
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

test.describe("Class Performance Report @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;
  let classRoomId;
  let ana;
  let ben;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = (await (await apiPost(request, "/api/v1/centers", { name: `QA Class Report ${Date.now()}` }, admin)).json()).id;
    classRoomId = (await (await apiPost(request, "/api/v1/classes", { centerId, name: "QA Toddlers" }, admin)).json()).id;
    const born = new Date();
    born.setMonth(born.getMonth() - 20);
    const kid = async (firstName, extra = {}) =>
      (await (await apiPost(request, "/api/v1/children", { centerId, classRoomId, firstName, lastName: "Tester", birthDate: born.toISOString().slice(0, 10), ...extra }, admin)).json()).id;
    ana = await kid("Ana", { allergies: "Peanuts" });
    ben = await kid("Ben");

    const cat = await (await apiPost(request, "/api/v1/lesson-categories", { centerId, name: "General" }, admin)).json();
    const walk = (await (await apiPost(request, "/api/v1/lessons", { centerId, isStep: true, title: "Walks", reference: "SP-1", categoryId: cat.id, ageYears: 1, ageMonths: 3 }, admin)).json()).id;
    await apiPut(request, `/api/v1/sop/${ana}`, { mode: "assessment", levels: [{ stepId: walk, level: "MASTERY" }] }, admin);
    await apiPut(request, `/api/v1/sop/${ben}`, { mode: "assessment", levels: [{ stepId: walk, level: "NOT_STARTED" }] }, admin);

    const log = (childId, type, details, days) => apiPost(request, "/api/v1/activities", { childId, type, details, createdAt: daysAgo(days) }, admin);
    await log(ana, "OTHER", { kind: "DAILY_GRADE", grade: 8 }, 2);
    await log(ben, "OTHER", { kind: "DAILY_GRADE", grade: 6 }, 2);
    await log(ben, "BEHAVIOR", { behaviorType: "PHYSICAL_VIOLENCE", behaviorLevel: "3" }, 3);
    await log(ana, "BEHAVIOR", { behaviorType: "RESPECT", behaviorLevel: "1" }, 3);
    await log(ana, "CHARACTER_HIGHLIGHT", { characterHighlightType: "BROTHERS_KEEPER" }, 1);
    await apiPost(request, "/api/v1/ipp", { childId: ben, startDate: "2026-09-01", reviewSchedule: "MONTHLY", status: "ACTIVE", focusArea: "Behavior", goals: [{ title: "Gentle hands", domain: "Behavior" }] }, admin);
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (centerId) await apiDelete(request, `/api/v1/centers/${centerId}`, admin);
  });

  test("the report lists milestones, citizenship, charts, plans and red flags", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const classes = await (await apiGet(request, "/api/v1/reports/classes", admin)).json();
    expect(classes.some((c) => c.id === classRoomId)).toBe(true);

    const res = await apiGet(request, `/api/v1/reports/class/${classRoomId}`, admin);
    expect(res.status(), await res.text()).toBe(200);
    const r = await res.json();
    expect(r.classroom).toMatchObject({ name: "QA Toddlers", students: 2 });
    // Ana mastered walking; Ben (about 20 months, walking expected at 15) is a month behind.
    expect(r.goals).toBeUndefined();
    expect(r.milestones[0].distribution).toMatchObject({ CRITICAL: 50, EXCELLING: 0 });
    expect(r.citizenship).toEqual([expect.objectContaining({ score: 7 })]);
    expect(r.courseCorrections.map((c) => c.type).sort()).toEqual(["PHYSICAL_VIOLENCE", "RESPECT"]);
    expect(r.characterHighlights).toEqual([expect.objectContaining({ type: "BROTHERS_KEEPER" })]);
    expect(r.ipps).toEqual([expect.objectContaining({ name: "Ben T.", focusArea: "Behavior" })]);
    // Ana's allergy and Ben's level 3 correction; Ana's level 1 is not a red flag.
    expect(r.redFlags.map((f) => f.flag).sort()).toEqual(["Allergy: Peanuts", "Physical violence"]);
  });

  test("teachers only see their own classes and parents none", async ({ request }) => {
    expect((await apiGet(request, `/api/v1/reports/class/${classRoomId}`, await loginAsTeacher(request))).status()).toBe(404);
    expect((await apiGet(request, "/api/v1/reports/classes", await loginAsParent(request))).status()).toBe(403);
  });
});
