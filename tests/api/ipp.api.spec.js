// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsStudentSupport, loginAsParent, loginAsTeacher, loginAsKitchenStaff } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiPatch, apiDelete } = require("../helpers/api");

const plan = (overrides = {}) => ({
  startDate: "2026-08-15",
  reviewSchedule: "SEMIANNUAL",
  status: "ACTIVE",
  planType: "Individual",
  focusArea: "Speech & Language",
  purpose: "Support communication in classroom routines.",
  measurableOutcomes: "Uses words to ask for help 3 times a day.",
  disciplinaryAction: "Calm-down corner first.",
  goals: [
    {
      title: "Use functional communication to express wants and needs.",
      domain: "Communication",
      targetDate: "2027-02-15",
      strategies: [
        { kind: "STRATEGY", text: "Use visual communication cards during transitions.", role: "Teacher", frequency: "Daily" },
        { kind: "SUPPORT", text: "Visual schedule with pictures", role: "Student Support", frequency: "Daily" },
        { text: "" },
      ],
    },
  ],
  ...overrides,
});

test.describe("Individual Progress Plans @api", () => {
  test.describe.configure({ mode: "serial" });
  let childId;
  let planId;
  let goalId;

  test.beforeAll(async ({ request }) => {
    // A child the demo parent and teacher can both see.
    const parent = await loginAsParent(request);
    const kids = await (await apiGet(request, "/api/v1/children", parent)).json();
    childId = kids[0].id;
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (planId) await apiDelete(request, `/api/v1/behavior-plans/${planId}`, admin);
  });

  test("Student Support creates a plan with goals, strategies and supports", async ({ request }) => {
    const support = await loginAsStudentSupport(request);
    const children = await (await apiGet(request, "/api/v1/ipp/children", support)).json();
    expect(children.some((c) => c.id === childId)).toBe(true);

    expect((await apiPost(request, "/api/v1/ipp", { ...plan(), childId, reviewSchedule: "" }, support)).status()).toBe(400);
    expect((await apiPost(request, "/api/v1/ipp", { ...plan({ goals: [] }), childId }, support)).status()).toBe(400);

    const res = await apiPost(request, "/api/v1/ipp", { ...plan(), childId }, support);
    expect(res.status(), await res.text()).toBe(201);
    planId = (await res.json()).id;

    const full = await (await apiGet(request, `/api/v1/ipp/${planId}`, support)).json();
    expect(full.canManage).toBe(true);
    expect(full.status).toBe("ACTIVE");
    expect(full.reviewSchedule).toBe("SEMIANNUAL");
    expect(full.disciplinaryAction).toBe("Calm-down corner first.");
    expect(full.goals).toHaveLength(1);
    // The blank strategy row is dropped.
    expect(full.goals[0].strategies.map((s) => s.kind)).toEqual(["STRATEGY", "SUPPORT"]);
    // Every 6 months from Aug 15 2026, so the next review is on the 15th.
    expect(new Date(full.nextReviewDate).getDate()).toBe(15);
    goalId = full.goals[0].id;

    const list = await (await apiGet(request, "/api/v1/ipp", support)).json();
    const row = list.plans.find((p) => p.id === planId);
    expect(row).toMatchObject({ planType: "Individual", focusArea: "Speech & Language", status: "ACTIVE", goals: 1 });
  });

  test("editing keeps the goal, adds another and records who updated it", async ({ request }) => {
    const support = await loginAsStudentSupport(request);
    const current = await (await apiGet(request, `/api/v1/ipp/${planId}`, support)).json();
    const body = plan({
      status: "UNDER_REVIEW",
      goals: [
        { ...current.goals[0], progress: 70 },
        { title: "Increase positive peer interactions during play.", domain: "Social Skills", strategies: [] },
      ],
    });
    const res = await apiPut(request, `/api/v1/ipp/${planId}`, body, support);
    expect(res.status(), await res.text()).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe("UNDER_REVIEW");
    expect(updated.goals.map((g) => g.id)[0]).toBe(goalId);
    expect(updated.goals[0].progress).toBe(70);
    expect(updated.goals).toHaveLength(2);
    expect(updated.updatedBy).toBeTruthy();
  });

  test("the IPP log and documents", async ({ request }) => {
    const support = await loginAsStudentSupport(request);
    const log = await apiPost(
      request,
      `/api/v1/ipp/${planId}/logs`,
      { date: "2026-10-10", goalId, tactic: "First/Then Chart", tacticDetail: "Morning routine", observation: "Transitioned with minimal prompts." },
      support,
    );
    expect(log.status(), await log.text()).toBe(201);
    expect((await apiPost(request, `/api/v1/ipp/${planId}/logs`, { date: "2026-10-10", tactic: "" }, support)).status()).toBe(400);

    // A teacher of the child can add to the log too.
    const teacher = await loginAsTeacher(request);
    expect((await apiPost(request, `/api/v1/ipp/${planId}/logs`, { date: "2026-10-11", tactic: "Sensory Break Kit" }, teacher)).status()).toBe(201);

    expect((await apiPost(request, `/api/v1/ipp/${planId}/documents`, { name: "x.pdf", url: "https://evil.example/x.pdf" }, support)).status()).toBe(400);
    const doc = await apiPost(request, `/api/v1/ipp/${planId}/documents`, { name: "OT Assessment Report.pdf", url: "/uploads/test-ot.pdf" }, support);
    expect(doc.status()).toBe(201);
    const docId = (await doc.json()).id;
    expect((await apiPatch(request, `/api/v1/ipp/${planId}/documents`, { documentId: docId, notes: "From the OT visit" }, support)).status()).toBe(200);

    const full = await (await apiGet(request, `/api/v1/ipp/${planId}`, support)).json();
    expect(full.logs.map((l) => l.tactic)).toEqual(["Sensory Break Kit", "First/Then Chart"]);
    expect(full.logs[1]).toMatchObject({ goal: "Communication", observation: "Transitioned with minimal prompts." });
    expect(full.documents[0]).toMatchObject({ name: "OT Assessment Report.pdf", fileType: "PDF", notes: "From the OT visit" });
  });

  test("parents and teachers read the plan but cannot change it, and do not see the disciplinary action", async ({ request }) => {
    for (const login of [loginAsParent, loginAsTeacher]) {
      const cookies = await login(request);
      const full = await (await apiGet(request, `/api/v1/ipp/${planId}`, cookies)).json();
      expect(full.canManage).toBe(false);
      expect(full.disciplinaryAction).toBeUndefined();
      expect(full.goals).toHaveLength(2);
      expect((await apiPut(request, `/api/v1/ipp/${planId}`, plan(), cookies)).status()).toBe(403);
    }
    const parent = await loginAsParent(request);
    expect((await apiPost(request, `/api/v1/ipp/${planId}/logs`, { date: "2026-10-12", tactic: "x" }, parent)).status()).toBe(403);
    const kitchen = await loginAsKitchenStaff(request);
    expect((await apiGet(request, `/api/v1/ipp/${planId}`, kitchen)).status()).toBe(403);
  });

  test("the list shows current plans by default and closed ones under all", async ({ request }) => {
    const support = await loginAsStudentSupport(request);
    const current = await (await apiGet(request, `/api/v1/ipp/${planId}`, support)).json();
    await apiPut(request, `/api/v1/ipp/${planId}`, plan({ status: "CLOSED", goals: current.goals }), support);
    const currentList = await (await apiGet(request, "/api/v1/ipp", support)).json();
    expect(currentList.plans.some((p) => p.id === planId)).toBe(false);
    const all = await (await apiGet(request, "/api/v1/ipp?view=all", support)).json();
    expect(all.plans.some((p) => p.id === planId && p.status === "CLOSED")).toBe(true);
  });
});
