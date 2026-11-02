// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsCoach, loginAsKitchenStaff, loginAsStudentSupport, loginAsTeacher, loginAsHrStaff } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function dayKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Role dashboards (client sheet 03, Phase 7) on a throwaway center: one
// classroom, two children (one with a peanut allergy, signed in today), an
// open IPP, a low citizenship grade and today's menu.
test.describe("Role dashboards @api", () => {
  test.describe.configure({ mode: "serial" });
  const stamp = Date.now();
  let center;
  let room;
  let ana;
  let ben;
  const summary = (request, view, cookies) => apiGet(request, `/api/v1/dashboard/summary?view=${view}&centerId=${center.id}`, cookies);

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Dashboards ${stamp}` }, admin)).json();
    room = await (await apiPost(request, "/api/v1/classes", { centerId: center.id, name: "QA Toddlers", capacity: 10 }, admin)).json();
    for (const [email, role] of [["coach@demo.com", "COACH"], ["kitchen@demo.com", "KITCHEN_STAFF"], ["support@demo.com", "STUDENT_SUPPORT"], ["hr@demo.com", "HR_STAFF"]]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) await prisma.centerUser.create({ data: { userId: user.id, centerId: center.id, role } });
    }
    const born = new Date();
    born.setMonth(born.getMonth() - 30);
    const kid = async (firstName, extra = {}) =>
      (await (await apiPost(request, "/api/v1/children", { centerId: center.id, classRoomId: room.id, firstName, lastName: `Dash${stamp}`, birthDate: dayKey(born), ...extra }, admin)).json()).id;
    ana = await kid("Ana", { allergies: "Peanuts" });
    ben = await kid("Ben");

    const day = new Date();
    day.setHours(0, 0, 0, 0);
    await prisma.attendance.create({ data: { day, centerId: center.id, childId: ana, classRoomId: room.id, checkedInAt: new Date() } });
    await apiPost(request, "/api/v1/activities", { childId: ben, type: "OTHER", details: { kind: "DAILY_GRADE", grade: 1 } }, admin);
    await apiPost(request, "/api/v1/ipp", { childId: ben, startDate: dayKey(new Date()), reviewSchedule: "QUARTERLY", status: "ACTIVE", focusArea: "Speech / Language", goals: [{ title: "Names objects", domain: "Language" }] }, admin);
    await prisma.menuItem.createMany({
      data: [
        { centerId: center.id, date: new Date(`${dayKey(new Date())}T00:00:00.000Z`), meal: "breakfast", ageGroup: "toddler", component: "grain", item: "Oatmeal" },
        { centerId: center.id, date: new Date(`${dayKey(new Date())}T00:00:00.000Z`), meal: "breakfast", ageGroup: "preschool", component: "grain", item: "Oatmeal" },
      ],
    });
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (center?.id) {
      await prisma.menuItem.deleteMany({ where: { centerId: center.id } });
      await prisma.complianceRequirement.deleteMany({ where: { centerId: center.id } });
      await apiDelete(request, `/api/v1/centers/${center.id}`, admin);
    }
  });

  test("admin: students signed in, classrooms, and overdue compliance as red flags", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const before = await (await summary(request, "admin", admin)).json();
    expect(before.students).toEqual({ in: 1, total: 2 });
    expect(before.classrooms).toEqual([expect.objectContaining({ name: "QA Toddlers", childrenIn: 1, capacity: 10, teachersIn: [] })]);

    const past = new Date();
    past.setDate(past.getDate() - 3);
    const made = await apiPost(request, "/api/v1/compliance/requirements", { centerId: center.id, name: "QA Fire drill", category: "Safety", frequency: "MONTHLY", nextDue: dayKey(past) }, admin);
    expect(made.status(), await made.text()).toBe(201);
    const after = await (await summary(request, "admin", admin)).json();
    expect(after.redFlags).toBe(before.redFlags + 1);
  });

  test("coach: red flags count children with an allergy or an open IPP", async ({ request }) => {
    const coach = await loginAsCoach(request);
    const res = await summary(request, "coach", coach);
    expect(res.status(), await res.text()).toBe(200);
    const r = await res.json();
    expect(r.redFlags).toBe(2);
    expect(r.pendingTimeOff).toBe(0);
  });

  test("kitchen: allergy updates, the food allergy list and today's menu", async ({ request }) => {
    const kitchen = await loginAsKitchenStaff(request);
    let r = await (await summary(request, "kitchen", kitchen)).json();
    // Ana was created with an allergy, which counts as an update.
    expect(r.allergyUpdates).toBe(1);
    expect(r.allergies).toEqual([expect.objectContaining({ name: `Ana Dash${stamp}`, allergens: ["Peanuts"], updated: true })]);
    expect(r.menu).toEqual([{ key: "breakfast", label: "Breakfast", items: ["Oatmeal"] }]);

    // A feeding plan saved for Ben is an infant feeding update; saving Ana
    // again without changing her allergy is not a new allergy update.
    const admin = await loginAsAdmin(request);
    await prisma.child.update({ where: { id: ana }, data: { allergiesUpdatedAt: null } });
    expect((await apiPut(request, `/api/v1/children/${ana}`, { allergies: "Peanuts" }, admin)).status()).toBe(200);
    expect((await apiPut(request, `/api/v1/children/${ben}`, { feedingPlan: { formula: "Similac", bottlesPerDay: 3 } }, admin)).status()).toBe(200);
    r = await (await summary(request, "kitchen", kitchen)).json();
    expect(r.allergyUpdates).toBe(0);
    expect(r.feedingUpdates).toBe(1);
  });

  test("student support: low character grades and students on IPP", async ({ request }) => {
    const support = await loginAsStudentSupport(request);
    const r = await (await summary(request, "support", support)).json();
    expect(r.alerts).toEqual([expect.objectContaining({ id: ben, grade: 1, room: "QA Toddlers", age: "2 yrs" })]);
    expect(r.ipps).toEqual([expect.objectContaining({ id: ben, focus: "Speech / Language", reviewDate: expect.any(String) })]);
  });

  test("HR staff rows include absences; each dashboard is limited to its roles", async ({ request }) => {
    const hr = await loginAsHrStaff(request);
    const perf = await (await apiGet(request, `/api/v1/reports/center-performance?staffOnly=1&centerId=${center.id}`, hr)).json();
    for (const s of perf.staff) expect(typeof s.absences).toBe("number");

    const teacher = await loginAsTeacher(request);
    expect((await summary(request, "admin", teacher)).status()).toBe(403);
    expect((await summary(request, "kitchen", await loginAsCoach(request))).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/dashboard/summary?view=nope&centerId=${center.id}`, await loginAsAdmin(request))).status()).toBe(400);
  });
});
