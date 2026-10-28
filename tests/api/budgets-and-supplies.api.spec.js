// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Phase 7a on a throwaway center: classroom budgets (admins add them, coaches
// enter expenses, budgets renew) and coach supply requests (pending count,
// a note the teacher is told about, status changes).
test.describe("Classroom budgets and supply requests (Phase 7a) @api", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let room;
  let coach;
  let teacher;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Budgets 7a ${Date.now()}` }, admin)).json();
    [coach, teacher] = await Promise.all(["coach@demo.com", "teacher@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })));
    await prisma.centerUser.createMany({
      data: [
        { userId: coach.id, centerId: center.id, role: "COACH" },
        { userId: teacher.id, centerId: center.id, role: "TEACHER" },
      ],
    });
    room = await prisma.classRoom.create({ data: { name: "Budget Room", centerId: center.id } });
  });

  test.afterAll(async ({ request }) => {
    await prisma.notification.deleteMany({ where: { recipientId: teacher.id, title: { startsWith: "Note on your supply request: QA" } } });
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("only admins add budgets; coaches enter expenses", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const coachCookies = await loginAsCoach(request);
    const body = { centerId: center.id, classRoomId: room.id, period: "MONTH", startDate: "2026-10-01", allocatedAmount: 200, autoRenew: false };
    expect((await apiPost(request, "/api/v1/classroom-budgets", body, coachCookies)).status()).toBe(403);
    const created = await apiPost(request, "/api/v1/classroom-budgets", body, admin);
    expect(created.status(), await created.text()).toBe(201);
    const budget = await created.json();
    expect(budget).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-31", period: "MONTH" });
    // A second budget can't overlap the first.
    expect((await apiPost(request, "/api/v1/classroom-budgets", { ...body, period: "WEEK", startDate: "2026-10-20" }, admin)).status()).toBe(409);

    const expense = await apiPost(request, `/api/v1/classroom-budgets/${budget.id}/expenses`, { description: "Paint", amount: 45.5, date: "2026-10-05", category: "Supplies" }, coachCookies);
    expect(expense.status(), await expense.text()).toBe(201);
    const list = await (await apiGet(request, `/api/v1/classroom-budgets?centerId=${center.id}&from=2026-10-01&to=2026-10-31`, coachCookies)).json();
    expect(list).toMatchObject({ canManage: false, canSpend: true });
    expect(list.budgets[0]).toMatchObject({ spent: 45.5, remaining: 154.5 });
    expect((await apiPut(request, `/api/v1/classroom-budgets/${budget.id}`, { allocatedAmount: 999 }, coachCookies)).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/classroom-budgets?centerId=${center.id}`, await loginAsTeacher(request))).status()).toBe(403);
  });

  test("an auto-renewing budget starts the next periods once it ends", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const other = await prisma.classRoom.create({ data: { name: "Renew Room", centerId: center.id } });
    const pad = (n) => String(n).padStart(2, "0");
    const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const start = new Date();
    start.setDate(start.getDate() - 20);
    const res = await apiPost(request, "/api/v1/classroom-budgets", {
      centerId: center.id, classRoomId: other.id, period: "WEEK", startDate: keyOf(start), allocatedAmount: 25, autoRenew: true,
    }, admin);
    expect(res.status(), await res.text()).toBe(201);
    const today = keyOf(new Date());
    const list = await (await apiGet(request, `/api/v1/classroom-budgets?centerId=${center.id}&from=${today}&to=${today}&classRoomId=${other.id}`, admin)).json();
    // Started 20 days ago: that week plus two renewals reach today.
    const rows = await prisma.classroomBudget.findMany({ where: { classRoomId: other.id }, orderBy: { startDate: "asc" } });
    expect(rows).toHaveLength(3);
    const second = new Date(start);
    second.setDate(second.getDate() + 7);
    expect(rows[1].startDate.toISOString().slice(0, 10)).toBe(keyOf(second));
    expect(rows.filter((r) => r.autoRenew)).toHaveLength(1);
    expect(list.budgets).toHaveLength(1);
    expect(list.budgets[0].autoRenew).toBe(true);
    expect(rows.every((r) => r.allocatedAmount === 25)).toBe(true);
  });

  test("coaches review supply requests and the teacher hears about the note", async ({ request }) => {
    const teacherCookies = await loginAsTeacher(request);
    const coachCookies = await loginAsCoach(request);
    const created = await apiPost(request, "/api/v1/supply-requests", { centerId: center.id, classRoomId: room.id, item: "QA Glue sticks", quantity: 3, notes: "for art" }, teacherCookies);
    expect(created.status(), await created.text()).toBe(201);
    const req = await created.json();

    const count = await (await apiGet(request, "/api/v1/supply-requests/pending-count", coachCookies)).json();
    expect(count.count).toBeGreaterThanOrEqual(1);
    expect((await apiGet(request, `/api/v1/lessons/supply-list?centerId=${center.id}`, coachCookies)).status()).toBe(200);

    const noted = await apiPut(request, `/api/v1/supply-requests/${req.id}`, { reviewNote: "Ordered, arriving Friday" }, coachCookies);
    expect(noted.status(), await noted.text()).toBe(200);
    expect(await noted.json()).toMatchObject({ reviewNote: "Ordered, arriving Friday", notes: "for art" });
    const notification = await prisma.notification.findFirst({ where: { recipientId: teacher.id, title: "Note on your supply request: QA Glue sticks" } });
    expect(notification?.body).toContain("Ordered, arriving Friday");

    const done = await apiPut(request, `/api/v1/supply-requests/${req.id}`, { status: "FULFILLED" }, coachCookies);
    expect((await done.json()).status).toBe("FULFILLED");
    // Teachers can't set the status or leave a review note.
    expect((await apiPut(request, `/api/v1/supply-requests/${req.id}`, { status: "PENDING" }, teacherCookies)).status()).toBe(403);
    expect((await apiPut(request, `/api/v1/supply-requests/${req.id}`, { reviewNote: "x" }, teacherCookies)).status()).toBe(403);
  });
});
