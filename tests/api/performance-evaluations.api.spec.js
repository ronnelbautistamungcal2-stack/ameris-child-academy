// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, loginAsHrStaff, getAuthCookie } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Phase 6c on a throwaway center: coaches write evaluations for their staff,
// staff see only their own submitted ones, everyone opens their own
// performance report, and coaches/HR get the Staff Performance Overview.
test.describe("Staff performance and evaluations (Phase 6c) @api", () => {
  test.describe.configure({ mode: "serial" });
  const password = "Password123!";
  let center;
  let other;
  let alice;
  let coach;
  let hr;
  let evaluationId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Perf 6c ${Date.now()}` }, admin)).json();
    other = await (await apiPost(request, "/api/v1/centers", { name: `QA Perf 6c Other ${Date.now()}` }, admin)).json();
    [coach, hr] = await Promise.all(["coach@demo.com", "hr@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })));
    await prisma.centerUser.createMany({
      data: [
        { userId: coach.id, centerId: center.id, role: "COACH" },
        { userId: hr.id, centerId: center.id, role: "HR_STAFF" },
      ],
    });
    const res = await apiPost(request, "/api/v1/users", { email: `alice6c-${Date.now()}@example.com`, name: "Alice Sixc", middleInitial: "S", password, roles: ["KITCHEN_STAFF"], centerId: center.id }, admin);
    alice = await res.json();
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (alice?.id) await apiDelete(request, `/api/v1/users/${alice.id}`, admin);
    for (const c of [center, other]) if (c?.id) await apiDelete(request, `/api/v1/centers/${c.id}`, admin);
    await prisma.$disconnect();
  });

  test("a coach creates a draft, then submits it; the employee only sees it once submitted", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const body = {
      centerId: center.id,
      teacherId: alice.id,
      evaluationType: "Annual Review",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      categories: { Communication: 4, Professionalism: 5, "Classroom Management": null },
      overallScore: 90,
      strengths: "Organized",
    };
    const created = await apiPost(request, "/api/v1/evaluations", body, coachCookies);
    expect(created.status(), await created.text()).toBe(201);
    const draft = await created.json();
    evaluationId = draft.id;
    expect(draft).toMatchObject({ status: "DRAFT", evaluationType: "Annual Review" });

    // Not at the coach's centers.
    expect((await apiPost(request, "/api/v1/evaluations", { ...body, centerId: other.id }, coachCookies)).status()).toBe(403);

    const aliceCookies = await getAuthCookie(request, alice.email, password);
    const before = await (await apiGet(request, `/api/v1/evaluations?mine=1&centerId=${center.id}`, aliceCookies)).json();
    expect(before.filter((e) => e.status !== "DRAFT")).toHaveLength(0);
    // Staff can't write evaluations.
    expect((await apiPost(request, "/api/v1/evaluations", body, aliceCookies)).status()).toBe(403);

    const submitted = await apiPut(request, `/api/v1/evaluations/${evaluationId}`, { status: "SUBMITTED", evaluationType: "Mid-Year Review" }, coachCookies);
    expect(submitted.status(), await submitted.text()).toBe(200);
    const after = await (await apiGet(request, `/api/v1/evaluations?mine=1&centerId=${center.id}`, aliceCookies)).json();
    expect(after).toEqual([expect.objectContaining({ id: evaluationId, status: "SUBMITTED", evaluationType: "Mid-Year Review" })]);

    // The coach's staff list for the center includes it.
    const list = await (await apiGet(request, `/api/v1/evaluations?centerId=${center.id}&from=2026-09-01&to=2026-09-30`, coachCookies)).json();
    expect(list.map((e) => e.id)).toContain(evaluationId);
  });

  test("everyone opens their own performance report; coaches and HR open their staff's", async ({ request }) => {
    const aliceCookies = await getAuthCookie(request, alice.email, password);
    const own = await apiGet(request, `/api/v1/analytics/teacher-perf-report?centerId=${center.id}&teacherId=me&from=2026-09-01&to=2026-10-31`, aliceCookies);
    expect(own.status(), await own.text()).toBe(200);
    const report = await own.json();
    expect(report.teacher.id).toBe(alice.id);
    // The submitted evaluation's overall score is a % (90), not out of 10.
    expect(report.gradeParts.evaluations).toBe(90);

    // Asking for someone else as staff still returns your own report.
    const sneaky = await (await apiGet(request, `/api/v1/analytics/teacher-perf-report?centerId=${center.id}&teacherId=${coach.id}`, aliceCookies)).json();
    expect(sneaky.teacher.id).toBe(alice.id);

    for (const cookies of [await loginAsCoach(request), await loginAsHrStaff(request)]) {
      const res = await apiGet(request, `/api/v1/analytics/teacher-perf-report?centerId=${center.id}&teacherId=${alice.id}`, cookies);
      expect(res.status()).toBe(200);
      expect((await res.json()).teacher.id).toBe(alice.id);
    }
  });

  test("coaches and HR get the Staff Performance Overview for their centers only", async ({ request }) => {
    for (const cookies of [await loginAsCoach(request), await loginAsHrStaff(request)]) {
      const res = await apiGet(request, `/api/v1/reports/center-performance?centerId=${center.id}&staffOnly=1`, cookies);
      expect(res.status(), await res.text()).toBe(200);
      const body = await res.json();
      expect(body.staff.some((s) => s.id === alice.id)).toBe(true);
      expect(body.students).toBeUndefined();
      expect((await apiGet(request, `/api/v1/reports/center-performance?centerId=${other.id}`, cookies)).status()).toBe(403);
    }
  });
});
