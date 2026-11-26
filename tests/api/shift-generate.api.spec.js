// @ts-check
// Shift Schedules: Apply weekly schedules (client sheet 10-29 (11), row 68).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut, pickDemoCenterId } = require("../helpers/api");

const prisma = new PrismaClient();

/** Monday N weeks from now, YYYY-MM-DD. */
function mondayIn(weeks) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("Shift Schedules from weekly schedules @api", () => {
  let centerId;
  let userId;

  test.afterAll(async ({ request }) => {
    if (userId) {
      await prisma.shiftSchedule.deleteMany({ where: { userId } });
      await prisma.shiftScheduleGeneration.deleteMany({ where: { userId } });
      await apiDelete(request, `/api/v1/users/${userId}`, await loginAsAdmin(request));
    }
    await prisma.$disconnect();
  });

  test("a week fills from the schedule, keeps hand edits, and refills after the schedule changes", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = pickDemoCenterId(await (await apiGet(request, "/api/v1/centers", admin)).json());
    const made = await apiPost(
      request,
      "/api/v1/users",
      {
        email: `shift-gen-${Date.now()}@example.com`,
        name: "Shift Gen",
        middleInitial: "G",
        password: "password123",
        roles: ["KITCHEN_STAFF"],
        centerId,
        weeklySchedules: [{ daysOfWeek: [1, 3], startTime: "08:00", endTime: "12:00" }],
      },
      admin,
    );
    expect(made.status(), await made.text()).toBe(201);
    userId = (await made.json()).id;

    const week = mondayIn(2);
    const generate = () => apiPost(request, "/api/v1/shifts/generate", { centerId, weekStart: week }, admin);
    const mine = async () =>
      (await (await apiGet(request, `/api/v1/shifts?centerId=${centerId}&from=${week}&to=${addDays(week, 6)}`, admin)).json()).filter((s) => s.userId === userId);

    expect((await (await generate()).json()).generated).toBe(2);
    let shifts = await mine();
    expect(shifts.map((s) => String(s.date).slice(0, 10)).sort()).toEqual([week, addDays(week, 2)]);
    // The position is their own role, not always Teacher.
    expect(shifts[0].position).toBe("Kitchen Staff");

    // A shift deleted by hand stays deleted.
    await apiDelete(request, `/api/v1/shifts/${shifts[0].id}`, admin);
    expect((await (await generate()).json()).generated).toBe(0);
    expect(await mine()).toHaveLength(1);

    // After the schedule changes (add Friday), the missing days fill in.
    const res = await apiPut(request, `/api/v1/users/${userId}`, { weeklySchedules: [{ daysOfWeek: [1, 3, 5], startTime: "08:00", endTime: "12:00" }] }, admin);
    expect(res.status(), await res.text()).toBe(200);
    expect((await (await generate()).json()).generated).toBe(2);
    shifts = await mine();
    expect(shifts.map((s) => String(s.date).slice(0, 10)).sort()).toEqual([week, addDays(week, 2), addDays(week, 4)]);
  });
});
