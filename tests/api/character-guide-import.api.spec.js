// @ts-check
// Character Guide per account and the Ameris guide Import (client 2026-11-07,
// step D). Each subscriber has its own guide; one with Teacher Training can
// copy the Ameris Character Guide into it, and importing again adds only new
// Ameris behaviors.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only people, accounts and Ameris guide rows, removed in afterAll.
const subEmail = `guide-sub-${stamp}@guide-test.local`;
const noTrainingEmail = `guide-nott-${stamp}@guide-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

const TREE = { question: { prompt: "Why did it happen?" }, branches: [{ id: "b1", label: "Tired", offenses: [{ steps: ["Offer a rest"] }] }] };

test.describe.configure({ mode: "serial" });

test.describe("Character Guide import @api", () => {
  const userIds = [];
  const accountIds = [];
  const amerisCategoryIds = [];
  const amerisBehaviorIds = [];
  let amerisAccountId = "";

  async function makeSubscriber(email, label, addOns) {
    const account = await prisma.subscriberAccount.create({
      data: { accountNumber: `G-${label}-${stamp}`, name: `Guide ${label} ${stamp}`, status: "ACTIVE", addOns },
    });
    accountIds.push(account.id);
    const center = await prisma.center.create({ data: { name: `Guide ${label} Center ${stamp}`, subscriberAccountId: account.id } });
    const user = await prisma.user.create({
      data: { email, name: email.split("@")[0], password: await bcrypt.hash(password, 10), role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: account.id },
    });
    userIds.push(user.id);
    await prisma.centerUser.create({ data: { userId: user.id, centerId: center.id, role: "ADMIN" } });
    return account;
  }

  async function amerisBehavior(name, categoryId) {
    const b = await prisma.characterBehavior.create({
      data: { subscriberAccountId: amerisAccountId, categoryId, name, type: "COURSE_CORRECTION", level: 2, description: `${name} description`, tree: TREE },
    });
    amerisBehaviorIds.push(b.id);
    return b;
  }

  test.beforeAll(async () => {
    const source = await prisma.center.findFirst({ where: { curriculumSource: true }, select: { subscriberAccountId: true } });
    amerisAccountId = source?.subscriberAccountId || (await prisma.subscriberAccount.findUnique({ where: { accountNumber: "C-1001" } }))?.id || "";
    expect(amerisAccountId).toBeTruthy();
    const cat = await prisma.characterCategory.create({ data: { subscriberAccountId: amerisAccountId, name: `Ameris Respect ${stamp}`, sortOrder: 900 } });
    amerisCategoryIds.push(cat.id);
    await amerisBehavior(`Ameris Hitting ${stamp}`, cat.id);
    await makeSubscriber(subEmail, "TT", ["TEACHER_TRAINING"]);
    await makeSubscriber(noTrainingEmail, "NO", []);
  });

  test.afterAll(async () => {
    await prisma.centerUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.characterBehavior.deleteMany({ where: { subscriberAccountId: { in: accountIds } } });
    await prisma.characterCategory.deleteMany({ where: { subscriberAccountId: { in: accountIds } } });
    await prisma.center.deleteMany({ where: { subscriberAccountId: { in: accountIds } } });
    await prisma.subscriberAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.characterBehavior.deleteMany({ where: { id: { in: amerisBehaviorIds } } });
    await prisma.characterCategory.deleteMany({ where: { id: { in: amerisCategoryIds } } });
    await prisma.$disconnect();
  });

  test("a new subscriber starts with an empty guide and can't touch the Ameris one", async ({ request }) => {
    const sub = await getAuthCookie(request, subEmail, password);
    expect(await (await apiGet(request, "/api/v1/character-guide/categories", sub)).json()).toEqual([]);
    expect(await (await apiGet(request, "/api/v1/character-guide/behaviors", sub)).json()).toEqual([]);
    expect((await apiGet(request, `/api/v1/character-guide/behaviors/${amerisBehaviorIds[0]}`, sub)).status()).toBe(404);
    expect((await apiPut(request, `/api/v1/character-guide/categories/${amerisCategoryIds[0]}`, { name: "Mine now" }, sub)).status()).toBe(404);

    // Their own category may reuse a name another account uses.
    const own = await apiPost(request, "/api/v1/character-guide/categories", { name: `Ameris Respect ${stamp}` }, sub);
    expect(own.status(), await own.text()).toBe(201);
    // ...and the Ameris account doesn't see it.
    const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
    const demoCats = await (await apiGet(request, "/api/v1/character-guide/categories", demo)).json();
    expect(demoCats.filter((c) => c.name === `Ameris Respect ${stamp}`).map((c) => c.id)).toEqual(amerisCategoryIds);
  });

  test("Import needs Teacher Training and isn't offered to the Ameris account", async ({ request }) => {
    const none = await getAuthCookie(request, noTrainingEmail, password);
    const status = await (await apiGet(request, "/api/v1/character-guide/import", none)).json();
    expect(status.canImport).toBe(false);
    expect(status.reason).toMatch(/Teacher Training/);
    expect((await apiPost(request, "/api/v1/character-guide/import", {}, none)).status()).toBe(403);

    const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
    expect((await (await apiGet(request, "/api/v1/character-guide/import", demo)).json()).canImport).toBe(false);
  });

  test("Import copies the Ameris guide; a second import adds only new behaviors", async ({ request }) => {
    const sub = await getAuthCookie(request, subEmail, password);
    const before = await (await apiGet(request, "/api/v1/character-guide/import", sub)).json();
    expect(before.canImport).toBe(true);
    expect(before.imported).toBe(0);
    expect(before.missing).toBe(before.ameris.behaviors);

    const first = await apiPost(request, "/api/v1/character-guide/import", {}, sub);
    expect(first.status(), await first.text()).toBe(200);
    // Other test files add to the Ameris guide (C-1001) at the same time.
    expect((await first.json()).behaviorsAdded).toBeGreaterThanOrEqual(before.ameris.behaviors);

    const mine = await (await apiGet(request, "/api/v1/character-guide/behaviors", sub)).json();
    const copy = mine.find((b) => b.name === `Ameris Hitting ${stamp}`);
    expect(copy).toBeTruthy();
    expect(copy.id).not.toBe(amerisBehaviorIds[0]);
    expect(copy.tree).toEqual(TREE);
    // Same-named category reused, not duplicated.
    const cats = await (await apiGet(request, "/api/v1/character-guide/categories", sub)).json();
    expect(cats.filter((c) => c.name === `Ameris Respect ${stamp}`)).toHaveLength(1);
    expect(copy.category.id).toBe(cats.find((c) => c.name === `Ameris Respect ${stamp}`).id);

    // Nothing new: refused (unless another test just added one). The
    // subscriber's edits stay theirs.
    const now = await (await apiGet(request, "/api/v1/character-guide/import", sub)).json();
    if (now.missing === 0) expect((await apiPost(request, "/api/v1/character-guide/import", {}, sub)).status()).toBe(409);
    await prisma.characterBehavior.update({ where: { id: copy.id }, data: { name: "Hitting (our wording)" } });

    // Ameris adds a behavior: only that one comes in.
    await amerisBehavior(`Ameris Biting ${stamp}`, amerisCategoryIds[0]);
    const again = await (await apiGet(request, "/api/v1/character-guide/import", sub)).json();
    expect(again.missing).toBeGreaterThanOrEqual(1);
    expect((await (await apiPost(request, "/api/v1/character-guide/import", {}, sub)).json()).behaviorsAdded).toBeGreaterThanOrEqual(1);
    const names = (await (await apiGet(request, "/api/v1/character-guide/behaviors", sub)).json()).map((b) => b.name);
    expect(names).toContain("Hitting (our wording)");
    expect(names).toContain(`Ameris Biting ${stamp}`);
    expect(names).not.toContain(`Ameris Hitting ${stamp}`);
  });
});
