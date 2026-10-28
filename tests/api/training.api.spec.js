// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, getAuthCookie } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Phase 6c Training on a throwaway center: admins build the Training Library
// and pathways, coaches only view and sign off, staff work through their
// trainings, and completed or recorded trainings count as training hours.
test.describe("Staff training (Phase 6c) @api", () => {
  test.describe.configure({ mode: "serial" });
  const password = "Password123!";
  let center;
  let kim;
  let kimCookies;
  let coach;
  let pathwayId;
  let readingId;
  let observedId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Training 6c ${Date.now()}` }, admin)).json();
    coach = await prisma.user.findUnique({ where: { email: "coach@demo.com" } });
    await prisma.centerUser.create({ data: { userId: coach.id, centerId: center.id, role: "COACH" } });
    const email = `kim6c-${Date.now()}@example.com`;
    kim = await (await apiPost(request, "/api/v1/users", { email, name: "Kim Training", middleInitial: "T", password, roles: ["KITCHEN_STAFF"], centerId: center.id }, admin)).json();
    kimCookies = await getAuthCookie(request, email, password);
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (kim?.id) await apiDelete(request, `/api/v1/users/${kim.id}`, admin);
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, admin);
    await prisma.$disconnect();
  });

  test("admins add pathways and trainings; coaches and staff cannot", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const pathway = { centerId: center.id, title: "Kitchen Onboarding", category: "Onboarding", description: "Start here", appliesToRoles: ["KITCHEN_STAFF"] };
    const created = await apiPost(request, "/api/v1/training/pathways", pathway, admin);
    expect(created.status(), await created.text()).toBe(201);
    pathwayId = (await created.json()).id;

    // Age groups are optional; title, category and description are not.
    expect((await apiPost(request, "/api/v1/training/pathways", { ...pathway, category: "" }, admin)).status()).toBe(400);
    expect((await apiPost(request, "/api/v1/training/pathways", pathway, await loginAsCoach(request))).status()).toBe(403);

    const reading = await apiPost(request, "/api/v1/training/items", {
      centerId: center.id,
      title: "Food Safety Basics",
      category: "Health & Safety",
      description: "Read the handbook",
      hours: 2,
      pathwayIds: [pathwayId],
      materials: [{ kind: "LINK", url: "https://example.com/food", name: "Handbook" }],
    }, admin);
    expect(reading.status(), await reading.text()).toBe(201);
    readingId = (await reading.json()).id;
    const observed = await apiPost(request, "/api/v1/training/items", {
      centerId: center.id,
      title: "Knife Handling",
      category: "Health & Safety",
      description: "Show it in the kitchen",
      observationRequired: true,
      pathwayIds: [pathwayId],
    }, admin);
    observedId = (await observed.json()).id;
    expect((await apiPost(request, "/api/v1/training/items", { centerId: center.id, title: "x", category: "y", description: "z" }, kimCookies)).status()).toBe(403);

    const detail = await (await apiGet(request, `/api/v1/training/pathways/${pathwayId}`, admin)).json();
    expect(detail.pathway.items.map((i) => i.title)).toEqual(["Food Safety Basics", "Knife Handling"]);
    expect(detail.assignedStaff.map((r) => r.name)).toContain("Kim Training");
  });

  test("staff see their pathway and complete a training, which adds its hours", async ({ request }) => {
    const mine = await (await apiGet(request, `/api/v1/training/pathways?centerId=${center.id}&mine=1`, kimCookies)).json();
    expect(mine.pathways.map((p) => p.id)).toEqual([pathwayId]);
    expect(mine.pathways[0].myProgress).toMatchObject({ total: 2, completed: 0, status: "NOT_STARTED" });

    // Staff can't see who else is assigned.
    const detail = await (await apiGet(request, `/api/v1/training/pathways/${pathwayId}`, kimCookies)).json();
    expect(detail.assignedStaff).toEqual([]);

    const viewed = await apiPut(request, `/api/v1/training/items/${readingId}/progress`, { action: "viewMaterial", materialIndex: 0 }, kimCookies);
    expect((await viewed.json()).status).toBe("IN_PROGRESS");
    const done = await apiPut(request, `/api/v1/training/items/${readingId}/progress`, { action: "complete" }, kimCookies);
    expect((await done.json()).status).toBe("COMPLETED");
    // Acknowledging again doesn't log the hours twice.
    await apiPut(request, `/api/v1/training/items/${readingId}/progress`, { action: "complete" }, kimCookies);

    const hours = await (await apiGet(request, `/api/v1/training/hours?centerId=${center.id}&userId=${kim.id}`, kimCookies)).json();
    expect(hours.logs.map((l) => [l.topic, l.source])).toEqual([["Food Safety Basics", "In-House Training"]]);
    expect(hours.totals.hours).toBe(2);

    const my = await (await apiGet(request, `/api/v1/training/my?centerId=${center.id}`, kimCookies)).json();
    expect(my.find((i) => i.id === readingId).myProgress.status).toBe("COMPLETED");
  });

  test("an observation request messages the coach, and the coach's sign-off completes it", async ({ request }) => {
    const ack = await apiPut(request, `/api/v1/training/items/${observedId}/progress`, { action: "complete" }, kimCookies);
    expect((await ack.json()).status).toBe("IN_PROGRESS");
    const asked = await apiPut(request, `/api/v1/training/items/${observedId}/progress`, { action: "requestObservation" }, kimCookies);
    expect((await asked.json()).observationStatus).toBe("REQUESTED");
    const message = await prisma.messageThread.findFirst({ where: { centerId: center.id, title: "Training request: Knife Handling", participants: { some: { userId: coach.id } } } });
    expect(message).toBeTruthy();

    // Staff can't sign themselves off.
    expect((await apiPut(request, `/api/v1/training/items/${observedId}/progress`, { action: "observationDone", userId: kim.id }, kimCookies)).status()).toBe(403);
    const coachCookies = await loginAsCoach(request);
    const signed = await apiPut(request, `/api/v1/training/items/${observedId}/progress`, { action: "observationDone", userId: kim.id }, coachCookies);
    expect((await signed.json()).status).toBe("COMPLETED");

    const progress = await (await apiGet(request, `/api/v1/training/progress?centerId=${center.id}`, coachCookies)).json();
    expect(progress.find((r) => r.userId === kim.id)).toMatchObject({ pathwayId, completed: 2, pct: 100, status: "COMPLETED" });
    expect((await apiGet(request, `/api/v1/training/progress?centerId=${center.id}`, kimCookies)).status()).toBe(403);
  });

  test("coaches record training for attendees and see each person's hours", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const res = await apiPost(request, "/api/v1/training-logs", {
      centerId: center.id,
      topic: "CPR Refresher",
      hours: 3,
      nonInteractiveHours: 1,
      interactiveHours: 2,
      date: "2026-10-05",
      performedBy: "Red Cross",
      source: "External Provider",
      userIds: [kim.id],
    }, coachCookies);
    expect(res.status(), await res.text()).toBe(201);

    const staff = await (await apiGet(request, `/api/v1/training/hours?centerId=${center.id}&from=2026-10-01&to=2026-10-31`, coachCookies)).json();
    const row = staff.find((s) => s.id === kim.id);
    expect(row.hours).toBeGreaterThanOrEqual(3);
    // Other staff can't open someone else's training hours.
    const other = await prisma.user.findUnique({ where: { email: "coach@demo.com" } });
    expect((await apiGet(request, `/api/v1/training/hours?centerId=${center.id}&userId=${other.id}`, kimCookies)).status()).toBe(403);
  });

  test("admins reorder and remove trainings on a pathway", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const base = { title: "Kitchen Onboarding", category: "Onboarding", description: "Start here", appliesToRoles: ["KITCHEN_STAFF"] };
    expect((await apiPut(request, `/api/v1/training/pathways/${pathwayId}`, { ...base, itemIds: [observedId, readingId] }, admin)).status()).toBe(200);
    let detail = await (await apiGet(request, `/api/v1/training/pathways/${pathwayId}`, admin)).json();
    expect(detail.pathway.items.map((i) => i.id)).toEqual([observedId, readingId]);

    await apiPut(request, `/api/v1/training/pathways/${pathwayId}`, { ...base, itemIds: [readingId] }, admin);
    detail = await (await apiGet(request, `/api/v1/training/pathways/${pathwayId}`, admin)).json();
    expect(detail.pathway.items.map((i) => i.id)).toEqual([readingId]);
    // The removed training stays in the library.
    expect((await apiGet(request, `/api/v1/training/items/${observedId}`, admin)).status()).toBe(200);
    expect((await apiPut(request, `/api/v1/training/pathways/${pathwayId}`, base, await loginAsCoach(request))).status()).toBe(403);
  });
});
