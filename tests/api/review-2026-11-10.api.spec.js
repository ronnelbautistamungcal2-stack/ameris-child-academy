// @ts-check
// Client review of 2026-11-10 (docs/client-requests/2026-10-29/REVIEW-2026-11-10.md):
// R25 one-day time off on a Mountain Time browser, R24 coach edits on the
// Student List (and other accounts can't reach the child), R13 Meal Claim
// only on open days and offered meals.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");
const { demoAccountId } = require("../helpers/accounts");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only people, accounts and center, removed in afterAll.
const coachEmail = `r1110-coach-${stamp}@review-test.local`;
const teacherEmail = `r1110-teacher-${stamp}@review-test.local`;
const otherAdminEmail = `r1110-other-${stamp}@review-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

test.describe.configure({ mode: "serial" });

test.describe("Client review 2026-11-10 @api", () => {
  const userIds = [];
  const accountIds = [];
  let centerId = "";
  let roomId = "";
  let childId = "";

  async function makeUser(email, data) {
    const user = await prisma.user.create({ data: { email, name: email.split("@")[0], password: await bcrypt.hash(password, 10), ...data } });
    userIds.push(user.id);
    return user;
  }

  test.beforeAll(async () => {
    const center = await prisma.center.create({
      data: {
        name: `Review 11-10 ${stamp}`,
        subscriberAccountId: await demoAccountId(prisma),
        // Open Monday to Thursday only; breakfast and lunch only.
        careSchedule: {
          monday: { open: true, start: "07:30", end: "17:00" },
          tuesday: { open: true, start: "07:30", end: "17:00" },
          wednesday: { open: true, start: "07:30", end: "17:00" },
          thursday: { open: true, start: "07:30", end: "17:00" },
          friday: { open: false, start: null, end: null },
          saturday: { open: false, start: null, end: null },
          sunday: { open: false, start: null, end: null },
        },
        meals: { breakfast: { provided: true, catered: false }, lunch: { provided: true, catered: false } },
      },
    });
    centerId = center.id;
    roomId = (await prisma.classRoom.create({ data: { name: "Review Room", centerId } })).id;
    childId = (await prisma.child.create({ data: { centerId, classRoomId: roomId, firstName: "QA", lastName: `Review ${stamp}` } })).id;
    const coach = await makeUser(coachEmail, { role: "COACH", roles: ["COACH"] });
    await prisma.centerUser.create({ data: { userId: coach.id, centerId, role: "COACH" } });
    const teacher = await makeUser(teacherEmail, { role: "TEACHER", roles: ["TEACHER"] });
    await prisma.centerUser.create({ data: { userId: teacher.id, centerId, role: "TEACHER" } });

    const other = await prisma.subscriberAccount.create({ data: { accountNumber: `R-${stamp}`, name: `Other ${stamp}`, status: "ACTIVE" } });
    accountIds.push(other.id);
    const otherCenter = await prisma.center.create({ data: { name: `Other Center ${stamp}`, subscriberAccountId: other.id } });
    const otherAdmin = await makeUser(otherAdminEmail, { role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: other.id });
    await prisma.centerUser.create({ data: { userId: otherAdmin.id, centerId: otherCenter.id, role: "ADMIN" } });
  });

  test.afterAll(async () => {
    await prisma.timeOffRequest.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.attendance.deleteMany({ where: { childId } });
    await prisma.child.deleteMany({ where: { centerId } });
    await prisma.centerUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.classRoom.deleteMany({ where: { centerId } });
    await prisma.center.deleteMany({ where: { OR: [{ id: centerId }, { subscriberAccountId: { in: accountIds } }] } });
    await prisma.subscriberAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.$disconnect();
  });

  test("R25: a one-day request from a Mountain Time browser is one day", async ({ request }) => {
    const teacher = await getAuthCookie(request, teacherEmail, password);
    // Thursday 2099-01-08 00:00-23:59 Mountain (UTC-7) is two UTC dates.
    const res = await apiPost(
      request,
      "/api/v1/time-off",
      { centerId, startDate: "2099-01-08T07:00:00.000Z", endDate: "2099-01-09T06:59:00.000Z", tzOffsetMinutes: 420 },
      teacher,
    );
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    expect(body.requests).toBeUndefined();
    expect(await prisma.timeOffRequest.count({ where: { userId: body.userId } })).toBe(1);

    // Thursday to Monday: three weekdays, each a whole local day.
    const multi = await (
      await apiPost(request, "/api/v1/time-off", { centerId, startDate: "2099-01-15T07:00:00.000Z", endDate: "2099-01-20T06:59:00.000Z", tzOffsetMinutes: 420 }, teacher)
    ).json();
    expect(multi.requests.map((r) => [r.startDate, r.endDate])).toEqual([
      ["2099-01-15T07:00:00.000Z", "2099-01-16T06:59:00.000Z"],
      ["2099-01-16T07:00:00.000Z", "2099-01-17T06:59:00.000Z"],
      ["2099-01-19T07:00:00.000Z", "2099-01-20T06:59:00.000Z"],
    ]);
  });

  test("R24: a coach edits the Student List; another account can't reach the child", async ({ request }) => {
    const coach = await getAuthCookie(request, coachEmail, password);
    const put = await apiPut(request, `/api/v1/children/${childId}`, { allergies: "Peanuts" }, coach);
    expect(put.status(), await put.text()).toBe(200);
    expect((await prisma.child.findUnique({ where: { id: childId } }))?.allergies).toBe("Peanuts");
    const checkIn = await apiPost(request, "/api/v1/attendance/check-in", { childId }, coach);
    expect(checkIn.status(), await checkIn.text()).toBeLessThan(300);
    const history = await apiGet(request, `/api/v1/attendance/history?centerId=${centerId}&from=2099-01-01T00:00:00&to=2099-01-02T00:00:00`, coach);
    expect(history.status()).toBe(200);
    expect((await apiGet(request, `/api/v1/children/${childId}/permissions`, coach)).status()).toBe(200);

    const other = await getAuthCookie(request, otherAdminEmail, password);
    expect((await apiGet(request, `/api/v1/children/${childId}`, other)).status()).toBe(404);
    expect((await apiPut(request, `/api/v1/children/${childId}`, { allergies: "None" }, other)).status()).toBe(404);
    expect((await apiGet(request, `/api/v1/children/${childId}/permissions`, other)).status()).toBe(403);
    expect((await apiPost(request, "/api/v1/attendance/transfer-classroom", { childId, targetClassRoomId: roomId }, other)).status()).toBe(403);
  });

  test("R13: Meal Claim lists only open days and offered meals", async ({ request }) => {
    const admin = await getAuthCookie(request, "admin@demo.com", "adminpass");
    // 2099-01-05 is a Monday; the week to Sunday 01-11.
    const res = await apiGet(request, `/api/v1/reports/meal-claim?centerId=${centerId}&from=2099-01-05&to=2099-01-11`, admin);
    expect(res.status(), await res.text()).toBe(200);
    const data = await res.json();
    expect(data.dates).toEqual(["2099-01-05", "2099-01-06", "2099-01-07", "2099-01-08"]);
    expect(data.meals.map((m) => m.key)).toEqual(["breakfast", "lunch"]);

    // Another account's admin can't open this center's reports.
    const other = await getAuthCookie(request, otherAdminEmail, password);
    expect((await apiGet(request, `/api/v1/reports/meal-claim?centerId=${centerId}&from=2099-01-05&to=2099-01-11`, other)).status()).toBe(403);
  });
});
