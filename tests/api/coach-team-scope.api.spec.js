// @ts-check
// A coach sees only their team on Evaluations, Staff Training and Staff
// Professional Development (client sheet 10-29 (11), row 11).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
const password = "Passw0rd!x";

test.describe("Coach team scope @api", () => {
  const ids = [];
  let center;
  let coach;
  let onTeam;
  let offTeam;

  test.beforeAll(async () => {
    center = await prisma.center.findFirst({ where: { name: "Demo Center" } });
    const make = async (key, role) => {
      const user = await prisma.user.create({
        data: { email: `team-${key}-${stamp}@team-test.local`, name: `Team ${key} ${stamp}`, password: await bcrypt.hash(password, 10), role, roles: [role], centers: { create: { centerId: center.id, role } } },
      });
      ids.push(user.id);
      return user;
    };
    coach = await make("coach", "COACH");
    onTeam = await make("on", "TEACHER");
    offTeam = await make("off", "TEACHER");
    await prisma.coachTeamMember.create({ data: { coachId: coach.id, staffId: onTeam.id } });
    for (const t of [onTeam, offTeam]) {
      await prisma.teacherEvaluation.create({ data: { teacherId: t.id, evaluatorId: coach.id, centerId: center.id, period: "2026-11" } });
    }
  });

  test.afterAll(async () => {
    await prisma.teacherEvaluation.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.coachTeamMember.deleteMany({ where: { coachId: { in: ids } } });
    await prisma.centerUser.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test("evaluations, training hours and training progress list only the team", async ({ request }) => {
    const cookies = await getAuthCookie(request, coach.email, password);
    const has = (list, id, key = "id") => (Array.isArray(list) ? list : list.rows || list.staff || []).some((r) => (typeof key === "function" ? key(r) : r[key]) === id);

    const hours = await (await apiGet(request, `/api/v1/training/hours?centerId=${center.id}`, cookies)).json();
    expect(has(hours, onTeam.id) || has(hours, onTeam.id, (r) => r.user?.id)).toBe(true);
    expect(has(hours, offTeam.id) || has(hours, offTeam.id, (r) => r.user?.id)).toBe(false);
    expect((await apiGet(request, `/api/v1/training/hours?centerId=${center.id}&userId=${offTeam.id}`, cookies)).status()).toBe(404);

    const progress = await (await apiGet(request, `/api/v1/training/progress?centerId=${center.id}`, cookies)).json();
    const progressIds = JSON.stringify(progress);
    expect(progressIds).toContain(onTeam.id);
    expect(progressIds).not.toContain(offTeam.id);

    const evalsRes = await apiGet(request, `/api/v1/evaluations?centerId=${center.id}`, cookies);
    expect(evalsRes.status(), await evalsRes.text()).toBe(200);
    const evals = await evalsRes.json();
    expect(evals.some((e) => e.teacherId === onTeam.id)).toBe(true);
    expect(evals.some((e) => e.teacherId === offTeam.id)).toBe(false);
  });
});
