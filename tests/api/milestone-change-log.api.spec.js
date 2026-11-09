// @ts-check
// Milestone Change Log (client sheet 2026-11-07): only real changes are
// listed, not a step's first assessment or a save that kept the same level.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost } = require("../helpers/api");

const prisma = new PrismaClient();

test.describe("Milestone Change Log @api", () => {
  let center = null;
  let child = null;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Change Log ${Date.now()}` }, admin)).json();
    child = await prisma.child.create({ data: { firstName: "Change", lastName: "Kid", centerId: center.id } });
    const step = await prisma.lesson.create({ data: { title: "Walks independently", centerId: center.id, isStep: true } });
    const progress = await prisma.progress.create({ data: { childId: child.id, lessonId: step.id, status: "IN_PROGRESS", goalIndex: 0 } });
    await prisma.progressEntry.createMany({
      data: [
        { progressId: progress.id, status: "NOT_STARTED", occurredAt: new Date("2031-03-02T15:00:00Z") },
        { progressId: progress.id, status: "IN_PROGRESS", occurredAt: new Date("2031-03-09T15:00:00Z") },
        { progressId: progress.id, status: "IN_PROGRESS", occurredAt: new Date("2031-03-16T15:00:00Z") },
      ],
    });
  });

  test.afterAll(async ({ request }) => {
    if (child?.id) {
      await prisma.progress.deleteMany({ where: { childId: child.id } });
      await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
    }
    // Only with a center: centerId undefined would match, and delete, every lesson.
    if (center?.id) {
      await prisma.lesson.deleteMany({ where: { centerId: center.id } });
      await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    }
    await prisma.$disconnect();
  });

  test("lists only the change, not the first assessment or a same-level save", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/reports/milestone-changes?centerId=${center.id}&from=2031-03-01&to=2031-03-31`, admin);
    expect(res.status()).toBe(200);
    const { rows } = await res.json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ milestone: "Walks independently", from: "Not Started" });
    expect(rows[0].to).not.toBe("Not Started");
  });
});
