// @ts-check
// Global Character Guide (client sheet 10-29 (11), row 66): Global admins
// edit it under Lesson Bank & SOP Bank, can fill it from Ameris Academy's
// guide, and every account (Ameris Academy too) imports from it.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { demoAccountId } = require("../helpers/accounts");
const { getAuthCookie, loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
const started = new Date();
const password = crypto.randomBytes(9).toString("base64url");
const globalEmail = `cg-global-${stamp}@guide-test.local`;
const subEmail = `cg-sub-${stamp}@guide-test.local`;

test.describe.configure({ mode: "serial" });

test.describe("Global Character Guide @api", () => {
  const userIds = [];
  let account = null;
  let globalCategory = null;
  let globalBehavior = null;
  let amerisBehavior = null;

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    account = await prisma.subscriberAccount.create({
      data: { accountNumber: `G-${stamp}`, name: `Guide Sub ${stamp}`, status: "ACTIVE", addOns: ["TEACHER_TRAINING"] },
    });
    userIds.push((await prisma.user.create({ data: { email: globalEmail, name: "CG Global", password: hash, role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] } })).id);
    userIds.push((await prisma.user.create({ data: { email: subEmail, name: "CG Sub", password: hash, role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: account.id } })).id);
    // An Ameris Academy behavior, to fill the Global guide from.
    const amerisId = await demoAccountId(prisma);
    const cat = await prisma.characterCategory.create({ data: { subscriberAccountId: amerisId, name: `QA Ameris ${stamp}` } });
    amerisBehavior = await prisma.characterBehavior.create({
      data: { subscriberAccountId: amerisId, categoryId: cat.id, name: `QA Ameris Behavior ${stamp}`, type: "COURSE_CORRECTION", description: "From Ameris Academy", tree: { branches: [] } },
    });
  });

  test.afterAll(async () => {
    // Global rows made by this run (the fill copies every Ameris Academy behavior).
    await prisma.characterBehavior.deleteMany({ where: { isGlobal: true, createdAt: { gte: started } } });
    await prisma.characterCategory.deleteMany({ where: { isGlobal: true, createdAt: { gte: started } } });
    if (amerisBehavior) {
      await prisma.characterBehavior.deleteMany({ where: { OR: [{ id: amerisBehavior.id }, { importedFromId: { not: null }, createdAt: { gte: started }, subscriberAccountId: amerisBehavior.subscriberAccountId }] } });
      await prisma.characterCategory.deleteMany({ where: { id: amerisBehavior.categoryId } });
      await prisma.characterCategory.deleteMany({ where: { subscriberAccountId: amerisBehavior.subscriberAccountId, createdAt: { gte: started }, behaviors: { none: {} } } });
    }
    if (account) {
      await prisma.characterBehavior.deleteMany({ where: { subscriberAccountId: account.id } });
      await prisma.characterCategory.deleteMany({ where: { subscriberAccountId: account.id } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (account) await prisma.subscriberAccount.deleteMany({ where: { id: account.id } });
    await prisma.$disconnect();
  });

  test("a Global admin edits the Global guide; it stays apart from accounts' guides", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const cat = await apiPost(request, "/api/v1/character-guide/categories?guide=global", { name: `QA Global ${stamp}` }, global);
    expect(cat.status(), await cat.text()).toBe(201);
    globalCategory = await cat.json();
    const made = await apiPost(
      request,
      "/api/v1/character-guide/behaviors?guide=global",
      { type: "COURSE_CORRECTION", name: `QA Global Behavior ${stamp}`, categoryId: globalCategory.id, description: "Global", tree: { question: { title: "Why?" }, branches: [{ title: "Tired", offenses: [{ steps: ["Rest"] }] }] } },
      global,
    );
    expect(made.status(), await made.text()).toBe(201);
    globalBehavior = await made.json();
    const row = await prisma.characterBehavior.findUnique({ where: { id: globalBehavior.id } });
    expect(row?.isGlobal).toBe(true);
    expect(row?.subscriberAccountId).toBeNull();

    const listed = await (await apiGet(request, "/api/v1/character-guide/behaviors?guide=global", global)).json();
    expect(listed.some((b) => b.id === globalBehavior.id)).toBe(true);
    const admin = await loginAsAdmin(request);
    const own = await (await apiGet(request, "/api/v1/character-guide/behaviors", admin)).json();
    expect(own.some((b) => b.id === globalBehavior.id)).toBe(false);
    // Not for center staff.
    expect((await apiGet(request, "/api/v1/character-guide/behaviors?guide=global", await loginAsTeacher(request))).status()).toBe(403);
    expect((await apiPost(request, "/api/v1/character-guide/categories?guide=global", { name: "Nope" }, admin)).status()).toBe(403);
  });

  test("the Global guide is filled from Ameris Academy, which then has nothing new to import", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const before = await (await apiGet(request, "/api/v1/character-guide/import?guide=global", global)).json();
    expect(before.canFill).toBe(true);
    const fill = await apiPost(request, "/api/v1/character-guide/import?guide=global", {}, global);
    expect(fill.status(), await fill.text()).toBe(200);
    expect((await fill.json()).behaviorsAdded).toBeGreaterThanOrEqual(1);
    const copy = await prisma.characterBehavior.findFirst({ where: { isGlobal: true, importedFromId: amerisBehavior.id } });
    expect(copy?.description).toBe("From Ameris Academy");
    expect((await (await apiGet(request, "/api/v1/character-guide/import?guide=global", global)).json()).canFill).toBe(false);

    // Ameris Academy may import too: only the behavior made in the Global guide
    // is new; its own originals count as already there, unchanged.
    const admin = await loginAsAdmin(request);
    const status = await (await apiGet(request, "/api/v1/character-guide/import", admin)).json();
    const globalOnly = await prisma.characterBehavior.count({ where: { isGlobal: true, importedFromId: null } });
    expect(status.missing).toBe(globalOnly);
    expect(status.updated).toBe(0);
    expect(status.canImport).toBe(globalOnly > 0);
  });

  test("an account imports the Global guide and Import again brings in Global changes", async ({ request }) => {
    const sub = await getAuthCookie(request, subEmail, password);
    const status = await (await apiGet(request, "/api/v1/character-guide/import", sub)).json();
    expect(status.canImport, JSON.stringify(status)).toBe(true);
    const total = await prisma.characterBehavior.count({ where: { isGlobal: true } });
    expect(status.missing).toBe(total);
    const res = await apiPost(request, "/api/v1/character-guide/import", {}, sub);
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).behaviorsAdded).toBe(total);
    const mine = await prisma.characterBehavior.findFirst({ where: { subscriberAccountId: account.id, importedFromId: globalBehavior.id } });
    expect(mine?.isGlobal).toBe(false);
    expect(mine?.name).toBe(`QA Global Behavior ${stamp}`);

    const global = await getAuthCookie(request, globalEmail, password);
    const edited = await apiPut(request, `/api/v1/character-guide/behaviors/${globalBehavior.id}?guide=global`, { ...globalBehavior, description: "Global, changed" }, global);
    expect(edited.status(), await edited.text()).toBe(200);
    const again = await (await apiGet(request, "/api/v1/character-guide/import", sub)).json();
    expect(again.missing).toBe(0);
    expect(again.updated).toBe(1);
    const res2 = await apiPost(request, "/api/v1/character-guide/import", {}, sub);
    expect((await res2.json()).behaviorsUpdated).toBe(1);
    expect((await prisma.characterBehavior.findUnique({ where: { id: mine.id } }))?.description).toBe("Global, changed");
  });
});
