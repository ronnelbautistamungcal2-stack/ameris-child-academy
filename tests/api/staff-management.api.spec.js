// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, loginAsHrStaff, loginAsTeacher, getAuthCookie } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

function key(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

// Phase 6b on a throwaway center: employment status, shift schedules for HR,
// Staff Attendance Overview with Move Today, time-off calendar labels and the
// employee time sheet e-signature.
test.describe("Staff management (Phase 6b) @api", () => {
  test.describe.configure({ mode: "serial" });
  const today = key(new Date());
  const password = "Password123!";
  let center;
  let roomA;
  let roomB;
  let alice; // teacher, stays employed
  let bob; // teacher, quits
  let hr;
  let coach;
  let teacher;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    [hr, coach, teacher] = await Promise.all(
      ["hr@demo.com", "coach@demo.com", "teacher@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })),
    );
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Staff Mgmt ${Date.now()}` }, admin)).json();
    await prisma.centerUser.createMany({
      data: [
        { userId: hr.id, centerId: center.id, role: "HR_STAFF" },
        { userId: coach.id, centerId: center.id, role: "COACH" },
      ],
    });
    const make = async (name) => {
      const res = await apiPost(request, "/api/v1/users", { email: `${name.toLowerCase()}-${Date.now()}@example.com`, name: `${name} QA`, middleInitial: "Q", password, roles: ["TEACHER"], centerId: center.id }, admin);
      expect(res.status(), await res.text()).toBeLessThan(300);
      return res.json();
    };
    alice = await make("Alice");
    bob = await make("Bob");
    roomA = await (await apiPost(request, "/api/v1/classes", { centerId: center.id, name: "QA Room A" }, admin)).json();
    roomB = await (await apiPost(request, "/api/v1/classes", { centerId: center.id, name: "QA Room B" }, admin)).json();
    await prisma.teacherClass.create({ data: { teacherId: alice.id, classId: roomA.id } });

    // Alice worked 8h and 7.5h, Bob 4h in the current fortnight.
    const at = (k, h, m) => new Date(`${k}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    const day = new Date(`${today}T00:00:00`);
    await prisma.staffAttendance.createMany({
      data: [
        { userId: alice.id, centerId: center.id, date: day, clockIn: at(today, 8, 0), clockOut: at(today, 16, 0) },
        { userId: bob.id, centerId: center.id, date: day, clockIn: at(today, 9, 0), clockOut: at(today, 13, 0) },
      ],
    });
  });

  test.afterAll(async ({ request }) => {
    if (center) {
      await prisma.teacherClass.deleteMany({ where: { classRoom: { centerId: center.id } } });
      const admin = await loginAsAdmin(request);
      for (const user of [alice, bob]) if (user?.id) await apiDelete(request, `/api/v1/users/${user.id}`, admin);
      await apiDelete(request, `/api/v1/centers/${center.id}`, admin);
    }
    await prisma.$disconnect();
  });

  test("employment status history; former staff drop off staff lists", async ({ request }) => {
    const hrCookies = await loginAsHrStaff(request);
    expect((await apiPut(request, `/api/v1/users/${bob.id}/employment`, { entries: [{ date: today, status: "QUIT" }] }, await loginAsTeacher(request))).status()).toBe(403);
    expect((await apiPut(request, `/api/v1/users/${bob.id}/employment`, { entries: [{ date: today, status: "RETIRED" }] }, hrCookies)).status()).toBe(400);

    const res = await apiPut(
      request,
      `/api/v1/users/${bob.id}/employment`,
      { entries: [{ date: "2026-01-05", status: "CURRENTLY_EMPLOYED", notes: "Initial hire." }, { date: today, status: "QUIT", notes: "Moved away" }] },
      hrCookies,
    );
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("QUIT");
    expect(body.entries.map((e) => e.status)).toEqual(["CURRENTLY_EMPLOYED", "QUIT"]);
    expect(body.entries[1].recordedByName).toBeTruthy();

    const coachCookies = await loginAsCoach(request);
    const positions = await (await apiGet(request, "/api/v1/teachers", coachCookies)).json();
    expect(positions.some((u) => u.id === alice.id)).toBe(true);
    expect(positions.some((u) => u.id === bob.id)).toBe(false);
    const staff = await (await apiGet(request, `/api/v1/users?centerId=${center.id}&roles=TEACHER`, hrCookies)).json();
    expect(staff.map((u) => u.id)).toEqual([alice.id]);
    const sheetList = await (await apiGet(request, `/api/v1/time-sheets/staff?centerId=${center.id}`, hrCookies)).json();
    expect(sheetList.find((u) => u.id === bob.id).employmentStatus).toBe("QUIT");
  });

  test("HR manages shifts; staff only read their own; other centers are closed", async ({ request }) => {
    const hrCookies = await loginAsHrStaff(request);
    const created = await apiPost(request, "/api/v1/shifts", { centerId: center.id, userId: alice.id, date: today, startTime: "07:00", endTime: "15:30", position: "Lead Teacher" }, hrCookies);
    expect(created.status(), await created.text()).toBeLessThan(300);
    const shifts = await (await apiGet(request, `/api/v1/shifts?centerId=${center.id}&from=${today}&to=${today}`, hrCookies)).json();
    expect(shifts).toHaveLength(1);

    const aliceCookies = await getAuthCookie(request, alice.email, password);
    expect((await apiGet(request, `/api/v1/shifts?centerId=${center.id}&from=${today}&to=${today}`, aliceCookies)).status()).toBe(200);
    // teacher@demo.com is not at this center.
    expect((await apiGet(request, `/api/v1/shifts?centerId=${center.id}`, await loginAsTeacher(request))).status()).toBe(403);
  });

  test("Staff Attendance Overview: hours highest first, Move Today changes the classroom", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const range = `from=${today}&to=${today}&date=${today}`;
    const res = await apiGet(request, `/api/v1/staff-attendance/overview?centerId=${center.id}&${range}`, coachCookies);
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    // Bob quit, so he is not listed; Alice (8h) comes before the 0h staff.
    expect(body.staff.some((s) => s.id === bob.id)).toBe(false);
    expect(body.staff[0].id).toBe(alice.id);
    expect(body.staff[0]).toMatchObject({ totalHours: 8, classRoomName: "QA Room A", moved: false, position: "Lead Teacher", shift: { startTime: "07:00", endTime: "15:30" } });

    const move = await apiPut(request, "/api/v1/staff-day-moves", { centerId: center.id, userId: alice.id, date: today, toClassRoomId: roomB.id }, coachCookies);
    expect(move.status(), await move.text()).toBe(200);
    const after = await (await apiGet(request, `/api/v1/staff-attendance/overview?centerId=${center.id}&${range}`, coachCookies)).json();
    expect(after.staff.find((x) => x.id === alice.id)).toMatchObject({ classRoomName: "QA Room B", moved: true, homeClassRoomId: roomA.id });

    // Alice's classroom checklist for today follows the move.
    const admin = await loginAsAdmin(request);
    for (const [title, room] of [["Room A list", roomA], ["Room B list", roomB]]) {
      await apiPost(request, "/api/v1/daily-checklists", { centerId: center.id, title, classRoomIds: [room.id], items: [{ title: "Task" }] }, admin);
    }
    const aliceCookies = await getAuthCookie(request, alice.email, password);
    const lists = await (await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}`, aliceCookies)).json();
    expect(lists.map((l) => l.title)).toEqual(["Room B list"]);

    expect((await apiPut(request, "/api/v1/staff-day-moves", { centerId: center.id, userId: alice.id, date: today, toClassRoomId: roomB.id }, aliceCookies)).status()).toBe(403);
    const undo = await request.delete("/api/v1/staff-day-moves", { headers: { cookie: coachCookies, "content-type": "application/json" }, data: { centerId: center.id, userId: alice.id, date: today } });
    expect(undo.status()).toBe(200);
    const restored = await (await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}`, aliceCookies)).json();
    expect(restored.map((l) => l.title)).toEqual(["Room A list"]);
  });

  test("time-off calendars show only the staff member's name", async ({ request }) => {
    const aliceCookies = await getAuthCookie(request, alice.email, password);
    const start = new Date(`${today}T09:00:00`);
    const end = new Date(`${today}T12:00:00`);
    const created = await apiPost(request, "/api/v1/time-off", { centerId: center.id, startDate: start.toISOString(), endDate: end.toISOString() }, aliceCookies);
    expect(created.status(), await created.text()).toBeLessThan(300);
    const rows = await (await apiGet(request, `/api/v1/time-off/calendar?centerId=${center.id}&from=${today}&to=${key(new Date(Date.now() + 2 * 86400000))}&includePending=1&includeEvents=1`, await loginAsCoach(request))).json();
    const mine = rows.filter((r) => r._source === "timeoff");
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.label === "Alice QA")).toBe(true);
  });

  test("an employee e-signs their own time sheet; managers can see it", async ({ request }) => {
    const aliceCookies = await getAuthCookie(request, alice.email, password);
    expect((await apiGet(request, `/api/v1/time-sheets/staff/${alice.id}?from=${today}&to=${today}`, aliceCookies)).status()).toBe(200);
    expect((await apiGet(request, `/api/v1/time-sheets/staff/${bob.id}`, aliceCookies)).status()).toBe(403);

    expect((await apiPost(request, "/api/v1/time-sheets/signatures", { from: today, to: today, signatureName: "Alice QA" }, aliceCookies)).status()).toBe(400);
    const signed = await apiPost(request, "/api/v1/time-sheets/signatures", { from: today, to: today, signatureName: "Alice QA", certify: true }, aliceCookies);
    expect(signed.status(), await signed.text()).toBe(201);
    expect(await signed.json()).toMatchObject({ from: today, to: today, signatureName: "Alice QA", totalHours: 8 });

    const seen = await (await apiGet(request, `/api/v1/time-sheets/signatures?userId=${alice.id}&from=${today}&to=${today}`, await loginAsHrStaff(request))).json();
    expect(seen).toHaveLength(1);
    expect((await apiGet(request, `/api/v1/time-sheets/signatures?userId=${alice.id}`, await getAuthCookie(request, bob.email, password))).status()).toBe(403);
  });
});
