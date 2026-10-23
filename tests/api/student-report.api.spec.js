// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsParent, loginAsKitchenStaff } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Student Performance Report on a throwaway center: a child about 20 months
// old with two assessed steps, Daily Log entries and an open IPP.
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

test.describe("Student Performance Report @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;
  let childId;
  let planId;
  let walk;
  let devStep;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = (await (await apiPost(request, "/api/v1/centers", { name: `QA Report ${Date.now()}` }, admin)).json()).id;
    const born = new Date();
    born.setMonth(born.getMonth() - 20);
    childId = (await (await apiPost(request, "/api/v1/children", { centerId, firstName: "Report", lastName: "Kid", birthDate: born.toISOString().slice(0, 10) }, admin)).json()).id;

    const cat = await (await apiPost(request, "/api/v1/lesson-categories", { centerId, name: "General" }, admin)).json();
    const step = async (title, ref, years, months) =>
      (await (await apiPost(request, "/api/v1/lessons", { centerId, isStep: true, title, reference: ref, categoryId: cat.id, subCategory: "Gross Motor", ageYears: years, ageMonths: months }, admin)).json()).id;
    walk = await step("Walks independently", "SP-1", 1, 3); // expected 15 months: behind
    const climb = await step("Climbs on low furniture", "SP-2", 2, 0); // expected 24 months: on track
    const dev = await (await apiPost(request, "/api/v1/lesson-categories", { centerId, name: "Development" }, admin)).json();
    devStep = (await (await apiPost(request, "/api/v1/lessons", { centerId, isStep: true, title: "Stacks blocks", reference: "SP-3", categoryId: dev.id, ageYears: 2, ageMonths: 6 }, admin)).json()).id;
    await apiPut(
      request,
      `/api/v1/sop/${childId}`,
      { mode: "assessment", levels: [{ stepId: walk, level: "EXPOSURE" }, { stepId: climb, level: "NOT_STARTED" }, { stepId: devStep, level: "NOT_STARTED" }], generate: true },
      admin,
    );

    const log = (type, details, days, notes) => apiPost(request, "/api/v1/activities", { childId, type, details, notes, createdAt: daysAgo(days) }, admin);
    await log("OTHER", { kind: "DAILY_GRADE", grade: 9 }, 10);
    await log("OTHER", { kind: "DAILY_GRADE", grade: 6 }, 3);
    await log("CHARACTER_HIGHLIGHT", { characterHighlightType: "BROTHERS_KEEPER" }, 5);
    await log("CHARACTER_HIGHLIGHT", { characterHighlightType: "CHAMPION_OF_HONESTY" }, 2);
    await log("BEHAVIOR", { behaviorType: "RESPECT", behaviorLevel: "3" }, 4, "Pushed a friend");
    await log("MEAL", { time: "11:25" }, 0);

    const plan = await apiPost(
      request,
      "/api/v1/ipp",
      { childId, startDate: "2026-09-24", reviewSchedule: "QUARTERLY", status: "ACTIVE", focusArea: "Social Skills", goals: [{ title: "Shares toys", domain: "Social Skills" }] },
      admin,
    );
    expect(plan.status(), await plan.text()).toBe(201);
    planId = (await plan.json()).id;
    const closed = await apiPost(
      request,
      "/api/v1/ipp",
      { childId, startDate: "2026-01-10", reviewSchedule: "QUARTERLY", status: "CLOSED", focusArea: "Toileting", goals: [{ title: "Uses the potty", domain: "Self-Help Skills" }] },
      admin,
    );
    expect(closed.status()).toBe(201);
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (centerId) await apiDelete(request, `/api/v1/centers/${centerId}`, admin);
  });

  test("the report gathers grades, goals, milestones, highlights, corrections, open IPPs and activity", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/reports/student/${childId}`, admin);
    expect(res.status(), await res.text()).toBe(200);
    const r = await res.json();

    expect(r.child.name).toBe("Report Kid");
    expect(r.citizenship.map((p) => p.score)).toEqual([9, 6]);
    expect(r.activeGoals.map((g) => g.title).sort()).toEqual(["Climbs on low furniture", "Stacks blocks", "Walks independently"]);

    // Walking (15 mo) not reached at ~20 mo is Critical; climbing (24 mo) and
    // stacking (30 mo) are On Track.
    expect(r.milestones.map((m) => m.name)).toEqual(["General", "Development"]);
    expect(r.milestones[0]).toMatchObject({ name: "General", distribution: { CRITICAL: 50, ON_TRACK: 50 } });
    expect(r.milestones[0].goals.map((g) => g.title).sort()).toEqual(["Climbs on low furniture", "Walks independently"]);
    // Milestones %: (40 + 100 + 100) / 3.
    expect(r.milestonePct).toBe(80);
    expect(r.canTrack).toBe("ALL");

    // Newest first.
    expect(r.characterHighlights.map((h) => h.label)).toEqual(["Champion of Honesty", "Brother's Keeper"]);
    expect(r.courseCorrections).toEqual([expect.objectContaining({ label: "Respect", level: 3, notes: "Pushed a friend" })]);

    // Only the open plan is listed.
    expect(r.ipps).toEqual([expect.objectContaining({ id: planId, title: "Social Skills", date: "2026-09-24" })]);
    expect(r.activity.some((a) => a.type === "MEAL")).toBe(true);
  });

  test("a date in Jump to Date returns that day's activity only", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const d = new Date(daysAgo(5));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const r = await (await apiGet(request, `/api/v1/reports/student/${childId}?logDate=${key}`, admin)).json();
    expect(r.activity.map((a) => a.type)).toEqual(["CHARACTER_HIGHLIGHT"]);
  });

  test("only the child's parents and staff who track the child can open it", async ({ request }) => {
    expect((await apiGet(request, `/api/v1/reports/student/${childId}`)).status()).toBe(401);
    expect((await apiGet(request, `/api/v1/reports/student/${childId}`, await loginAsParent(request))).status()).toBe(404);
    expect((await apiGet(request, `/api/v1/reports/student/${childId}`, await loginAsKitchenStaff(request))).status()).toBe(404);
  });

  test("a parent can mark off General goals only", async ({ request }) => {
    const parentUser = await prisma.user.findUnique({ where: { email: "parent@demo.com" } });
    await prisma.child.update({ where: { id: childId }, data: { parentId: parentUser.id } });
    const parent = await loginAsParent(request);
    const r = await (await apiGet(request, `/api/v1/reports/student/${childId}`, parent)).json();
    expect(r.canTrack).toBe("GENERAL");

    const blocked = await apiPut(request, `/api/v1/sop/${childId}`, { mode: "tracking", levels: [{ stepId: devStep, level: "EXPOSURE" }] }, parent);
    expect(blocked.status()).toBe(403);
    const ok = await apiPut(request, `/api/v1/sop/${childId}`, { mode: "tracking", levels: [{ stepId: walk, level: "COMPETENCY" }] }, parent);
    expect(ok.status(), await ok.text()).toBe(200);
    const after = await (await apiGet(request, `/api/v1/reports/student/${childId}`, parent)).json();
    expect(after.milestones[0].goals.find((g) => g.title === "Walks independently").level).toBe("COMPETENCY");
    // Parents can only save; reading the staff SOP data is refused.
    expect((await apiGet(request, `/api/v1/sop/${childId}`, parent)).status()).toBe(405);
    await prisma.child.update({ where: { id: childId }, data: { parentId: null } });
    await prisma.$disconnect();
  });
});
