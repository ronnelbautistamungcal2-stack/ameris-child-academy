// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsStudentSupport, loginAsParent, loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

// SOP Tracking on a throwaway center: three linked steps (crawl -> walk ->
// climb) and a child about 20 months old.
function monthsAgo(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

test.describe("SOP Tracking @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;
  let childId;
  const steps = {};

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = (await (await apiPost(request, "/api/v1/centers", { name: `QA SOP ${Date.now()}` }, admin)).json()).id;
    const child = await apiPost(request, "/api/v1/children", { centerId, firstName: "Sop", lastName: "Kid", birthDate: monthsAgo(20) }, admin);
    expect(child.status(), await child.text()).toBe(201);
    childId = (await child.json()).id;

    const make = async (key, title, ageMonths, extra = {}) => {
      const res = await apiPost(
        request,
        "/api/v1/lessons",
        { centerId, isStep: true, title, reference: `SP-${key}`, subCategory: "Gross Motor - Mobility", ageYears: Math.floor(ageMonths / 12), ageMonths: ageMonths % 12, description: `Can the child ${title.toLowerCase()}?`, ...extra },
        admin,
      );
      expect(res.status(), await res.text()).toBe(201);
      steps[key] = (await res.json()).id;
    };
    await make("crawl", "Crawls on hands and knees", 10);
    await make("walk", "Walks independently", 15, { priorStepId: steps.crawl });
    await make("climb", "Climbs on low furniture", 22, { priorStepId: steps.walk });
    await apiPut(request, `/api/v1/lessons/${steps.crawl}`, { title: "Crawls on hands and knees", media: [], nextStepId: steps.walk }, admin);
    await apiPut(request, `/api/v1/lessons/${steps.walk}`, { title: "Walks independently", media: [], nextStepId: steps.climb }, admin);
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (centerId) await apiDelete(request, `/api/v1/centers/${centerId}`, admin);
  });

  test("the assessment lists the center's steps; Generate Active Goals picks what to work on", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const url = `/api/v1/sop/${childId}`;
    // The child's own view lists only goals (none yet); the assessment view
    // lists the bank's steps, every age with all=1.
    let data = await (await apiGet(request, url, admin)).json();
    expect(data.steps).toEqual([]);
    data = await (await apiGet(request, `${url}?view=assessment&all=1`, admin)).json();
    expect(data.steps.map((s) => s.reference).sort()).toEqual(["SP-climb", "SP-crawl", "SP-walk"]);
    expect(data.steps.every((s) => s.level === null && !s.active)).toBe(true);

    // Walking is not started, so the previous step (crawling) gets assessed:
    // the child crawls at Mastery.
    const save = await apiPut(
      request,
      url,
      { mode: "assessment", levels: [{ stepId: steps.walk, level: "NOT_STARTED", notes: "Pulls to stand only" }, { stepId: steps.crawl, level: "MASTERY" }] },
      admin,
    );
    expect(save.status(), await save.text()).toBe(200);
    data = await save.json();
    expect(data.steps.find((s) => s.id === steps.walk)).toMatchObject({ level: "NOT_STARTED", notes: "Pulls to stand only", assessed: true, active: false });

    // Unclicking a step (client sheet 10-29 (11), row 21): climbing marked by
    // mistake, then cleared, has no level and isn't assessed.
    await apiPut(request, url, { mode: "assessment", levels: [{ stepId: steps.climb, level: "EXPOSURE" }] }, admin);
    const cleared = await apiPut(request, url, { mode: "assessment", levels: [{ stepId: steps.climb, level: "CLEAR" }] }, admin);
    expect(cleared.status(), await cleared.text()).toBe(200);
    expect((await cleared.json()).steps.find((s) => s.id === steps.climb)).toMatchObject({ level: null, assessed: false });
    // Only the assessment can clear.
    expect((await apiPut(request, url, { mode: "tracking", levels: [{ stepId: steps.climb, level: "CLEAR" }] }, admin)).status()).toBe(400);

    data = await (await apiPut(request, url, { mode: "assessment", levels: [], generate: true }, admin)).json();
    const active = data.steps.filter((s) => s.active).map((s) => s.reference);
    // Crawling is mastered, so its next step, walking, is the goal.
    expect(active).toEqual(["SP-walk"]);
    expect(data.activeGoals).toBe(1);
    // Walking was expected at 15 months and the child is about 20: Critical.
    expect(data.status).toBe("CRITICAL");
  });

  test("an active goal opens the lesson set on its step", async ({ request }) => {
    // Client sheet 10-29 (11), row 49. Walking is the active goal after the test above.
    const admin = await loginAsAdmin(request);
    const lesson = await apiPost(request, "/api/v1/lessons", { centerId, title: "Walking practice" }, admin);
    expect(lesson.status(), await lesson.text()).toBe(201);
    const lessonId = (await lesson.json()).id;
    expect((await apiPut(request, `/api/v1/lessons/${steps.walk}`, { title: "Walks independently", media: [], linkedLessonId: lessonId }, admin)).status()).toBe(200);
    const report = await (await apiGet(request, `/api/v1/reports/student/${childId}`, admin)).json();
    expect(report.activeGoals.find((g) => g.id === steps.walk)).toMatchObject({ lessonId });
    // Student Support at the center can open it; someone with no access to the center can't.
    const email = `qa-support-${Date.now()}@sop-test.local`;
    const made = await apiPost(request, "/api/v1/users", { email, name: "QA Support", middleInitial: "S", password: "Passw0rd!x", roles: ["STUDENT_SUPPORT"], centerId }, admin);
    expect(made.status(), await made.text()).toBe(201);
    const supportId = (await made.json()).id;
    try {
      const { getAuthCookie } = require("../helpers/auth");
      expect((await apiGet(request, `/api/v1/lessons/${lessonId}`, await getAuthCookie(request, email, "Passw0rd!x"))).status()).toBe(200);
      expect((await apiGet(request, `/api/v1/lessons/${lessonId}`, await loginAsStudentSupport(request))).status()).toBe(404);
    } finally {
      await apiDelete(request, `/api/v1/users/${supportId}`, admin);
    }
  });

  test("the assessment shows only steps for the child's actual age", async ({ request }) => {
    // Client 2026-11-20: a child of 1 year 9 months sees nothing that ends at
    // 1 year 8 months or starts at 1 year 10 months. This child is 20 months.
    const admin = await loginAsAdmin(request);
    const ranged = async (ref, title, min, max) => {
      const res = await apiPost(
        request,
        "/api/v1/lessons",
        { centerId, isStep: true, title, reference: ref, subCategory: "Fine Motor - Ranges", ageYears: Math.floor(min / 12), ageMonths: min % 12, maxAgeYears: Math.floor(max / 12), maxAgeMonths: max % 12 },
        admin,
      );
      expect(res.status(), await res.text()).toBe(201);
    };
    await ranged("SP-r-early", "Stacks two blocks", 12, 19);
    await ranged("SP-r-now", "Stacks three blocks", 18, 22);
    await ranged("SP-r-later", "Stacks five blocks", 21, 30);
    const url = `/api/v1/sop/${childId}?view=assessment`;
    const refs = async (q = "") =>
      (await (await apiGet(request, q ? `${url}&q=${encodeURIComponent(q)}` : url, admin)).json()).steps.map((x) => x.reference).filter((r) => r.startsWith("SP-r-"));
    expect(await refs()).toEqual(["SP-r-now"]);
    // A search stays within the child's age too.
    expect(await refs("Stacks")).toEqual(["SP-r-now"]);
    // Admins can still see every age.
    const all = (await (await apiGet(request, `${url}&all=1`, admin)).json()).steps.map((x) => x.reference).filter((r) => r.startsWith("SP-r-"));
    expect(all.sort()).toEqual(["SP-r-early", "SP-r-later", "SP-r-now"]);
  });

  test("tracking: reaching Competency brings in the next goal; Mastery retires the goal", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const url = `/api/v1/sop/${childId}`;
    let data = await (await apiPut(request, url, { mode: "tracking", levels: [{ stepId: steps.walk, level: "COMPETENCY" }] }, admin)).json();
    expect(data.steps.filter((s) => s.active).map((s) => s.reference).sort()).toEqual(["SP-climb", "SP-walk"]);

    data = await (await apiPut(request, url, { mode: "tracking", levels: [{ stepId: steps.walk, level: "MASTERY" }] }, admin)).json();
    expect(data.steps.filter((s) => s.active).map((s) => s.reference)).toEqual(["SP-climb"]);
    // Climbing is expected at 22 months; the child is 20 and not there yet: On Track.
    expect(data.status).toBe("ON_TRACK");
    expect(data.categories.General.activeGoals).toBe(1);

    const list = await (await apiGet(request, `/api/v1/sop/tracking?centerId=${centerId}`, admin)).json();
    expect(list).toEqual([expect.objectContaining({ id: childId, activeGoals: 1, status: "ON_TRACK" })]);
  });

  test("bad levels and other people's children are refused", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    expect((await apiPut(request, `/api/v1/sop/${childId}`, { levels: [{ stepId: steps.walk, level: "GREAT" }] }, admin)).status()).toBe(400);
    expect((await apiPut(request, `/api/v1/sop/${childId}`, { levels: [{ stepId: "nope", level: "MASTERY" }] }, admin)).status()).toBe(400);

    // Student Support and teachers outside this center cannot open the child.
    expect((await apiGet(request, `/api/v1/sop/${childId}`, await loginAsStudentSupport(request))).status()).toBe(404);
    expect((await apiGet(request, `/api/v1/sop/${childId}`, await loginAsTeacher(request))).status()).toBe(404);
    expect((await apiGet(request, `/api/v1/sop/${childId}`, await loginAsParent(request))).status()).toBe(403);
  });
});
