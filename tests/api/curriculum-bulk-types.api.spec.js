// @ts-check
// Set Types on many lessons or steps at once (client 2026-11-10: production's
// 1,790 lessons and 46,515 steps have no curriculum type ticked).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost } = require("../helpers/api");
const { demoAccountId } = require("../helpers/accounts");

const prisma = new PrismaClient();
const stamp = Date.now();

test.describe.configure({ mode: "serial" });

test.describe("Curriculum bulk types @api", () => {
  let centerId = "";
  const ids = {};

  test.beforeAll(async () => {
    // A throwaway center in the demo account, removed in afterAll.
    centerId = (await prisma.center.create({ data: { name: `Bulk Types ${stamp}`, subscriberAccountId: await demoAccountId(prisma) } })).id;
    const make = async (key, data) => {
      ids[key] = (await prisma.lesson.create({ data: { centerId, title: `${key} ${stamp}`, ...data } })).id;
    };
    await make("stepChristian", { isStep: true, type: "Christian" });
    await make("stepDccs", { isStep: true, type: "DCCS" });
    await make("stepBlank", { isStep: true });
    await make("stepTyped", { isStep: true, types: ["OTHER"] });
    await make("lessonA", {});
    await make("lessonB", { types: ["NON_DENOMINATIONAL"] });
  });

  test.afterAll(async () => {
    await prisma.lesson.deleteMany({ where: { centerId } });
    await prisma.center.deleteMany({ where: { id: centerId } });
    await prisma.$disconnect();
  });

  const typesOf = async (key) => (await prisma.lesson.findUnique({ where: { id: ids[key] } }))?.types;

  test("the Steps bank filters by type and old Type", async ({ request }) => {
    const admin = await getAuthCookie(request, "admin@demo.com", "adminpass");
    const all = await (await apiGet(request, `/api/v1/lessons/steps-page?centerId=${centerId}&pageSize=50`, admin)).json();
    const facet = Object.fromEntries(all.facets.type.map((o) => [o.value, o.count]));
    expect(facet).toMatchObject({ NONE: 3, OTHER: 1, "OLD:Christian": 1, "OLD:DCCS": 1 });
    const none = await (await apiGet(request, `/api/v1/lessons/steps-page?centerId=${centerId}&pageSize=50&type=NONE`, admin)).json();
    expect(none.total).toBe(3);
  });

  test("Set Types: old Type Christian becomes Non-Denominational Christian; the rest get Non-Denominational", async ({ request }) => {
    const admin = await getAuthCookie(request, "admin@demo.com", "adminpass");
    const christian = await apiPost(
      request,
      "/api/v1/lessons/bulk-types",
      { centerId, kind: "step", action: "add", types: ["NON_DENOMINATIONAL_CHRISTIAN"], filter: { type: "OLD:Christian" } },
      admin,
    );
    expect(christian.status(), await christian.text()).toBe(200);
    expect((await christian.json()).updated).toBe(1);
    expect(await typesOf("stepChristian")).toEqual(["NON_DENOMINATIONAL_CHRISTIAN"]);

    const rest = await (
      await apiPost(request, "/api/v1/lessons/bulk-types", { centerId, kind: "step", action: "add", types: ["NON_DENOMINATIONAL"], filter: { type: "NONE" } }, admin)
    ).json();
    expect(rest.updated).toBe(2);
    expect(await typesOf("stepDccs")).toEqual(["NON_DENOMINATIONAL"]);
    expect(await typesOf("stepTyped")).toEqual(["OTHER"]);

    // add keeps the standard order; remove takes one off; set replaces.
    await apiPost(request, "/api/v1/lessons/bulk-types", { centerId, kind: "step", action: "add", types: ["NON_DENOMINATIONAL"], ids: [ids.stepTyped] }, admin);
    expect(await typesOf("stepTyped")).toEqual(["NON_DENOMINATIONAL", "OTHER"]);
    await apiPost(request, "/api/v1/lessons/bulk-types", { centerId, kind: "step", action: "remove", types: ["OTHER"], ids: [ids.stepTyped] }, admin);
    expect(await typesOf("stepTyped")).toEqual(["NON_DENOMINATIONAL"]);
    await apiPost(request, "/api/v1/lessons/bulk-types", { centerId, kind: "step", action: "set", types: ["OTHER"], ids: [ids.stepTyped] }, admin);
    expect(await typesOf("stepTyped")).toEqual(["OTHER"]);
  });

  test("lessons by id; steps, other kinds and other centers are left alone", async ({ request }) => {
    const admin = await getAuthCookie(request, "admin@demo.com", "adminpass");
    const res = await apiPost(
      request,
      "/api/v1/lessons/bulk-types",
      { centerId, kind: "lesson", action: "add", types: ["OTHER"], ids: [ids.lessonA, ids.lessonB, ids.stepBlank, "not-an-id"] },
      admin,
    );
    expect((await res.json()).updated).toBe(2);
    expect(await typesOf("lessonA")).toEqual(["OTHER"]);
    expect(await typesOf("lessonB")).toEqual(["NON_DENOMINATIONAL", "OTHER"]);
    expect(await typesOf("stepBlank")).toEqual(["NON_DENOMINATIONAL"]);

    expect((await apiPost(request, "/api/v1/lessons/bulk-types", { centerId, kind: "lesson", action: "add", types: [], ids: [ids.lessonA] }, admin)).status()).toBe(400);
    const teacher = await getAuthCookie(request, "teacher@demo.com", "teacherpass");
    expect((await apiPost(request, "/api/v1/lessons/bulk-types", { centerId, kind: "lesson", action: "add", types: ["OTHER"], ids: [ids.lessonA] }, teacher)).status()).toBe(403);
  });
});
