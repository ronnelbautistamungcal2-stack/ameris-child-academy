// @ts-check
// A new subscriber's admin and coach must never see another account's data
// (client sheet 10-29, rows 41/42/47: a new subscriber saw Ameris Academy's
// classrooms, students and kiosks). Lists called without ?centerId used to
// return every center's rows.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");

const prisma = new PrismaClient();
const stamp = Date.now();
const password = crypto.randomBytes(9).toString("base64url");
const adminEmail = `iso-admin-${stamp}@iso-test.local`;
const coachEmail = `iso-coach-${stamp}@iso-test.local`;

// Lists the admin and coach portal pages call with no center picked.
const LISTS = [
  "/api/v1/children",
  "/api/v1/classes",
  "/api/v1/activities",
  "/api/v1/progress",
  "/api/v1/child-flags",
  "/api/v1/lessons",
  "/api/v1/lesson-categories",
  "/api/v1/time-off",
  "/api/v1/training-logs",
  "/api/v1/coach/dashboard",
];
const ADMIN_ONLY = ["/api/v1/kiosk/devices", "/api/v1/invites"];

test.describe.configure({ mode: "serial" });

test.describe("Subscriber data isolation @api", () => {
  let accountId = "";
  let centerId = "";

  test.beforeAll(async () => {
    const account = await prisma.subscriberAccount.create({
      data: { accountNumber: `ISO-${stamp}`, name: `Isolation ${stamp}`, status: "ACTIVE", addOns: ["STEPS_OF_PROGRESSION", "CURRICULUM", "STAFF_MANAGEMENT", "TEACHER_TRAINING"] },
    });
    accountId = account.id;
    centerId = (await prisma.center.create({ data: { name: `Isolation Center ${stamp}`, subscriberAccountId: accountId } })).id;
    const hash = await bcrypt.hash(password, 10);
    for (const [email, role] of [
      [adminEmail, "ADMIN"],
      [coachEmail, "COACH"],
    ]) {
      await prisma.user.create({
        data: { email, name: `Isolation ${role}`, password: hash, role, roles: [role], subscriberAccountId: accountId, centers: { create: { centerId, role } } },
      });
    }
  });

  test.afterAll(async () => {
    const ids = (await prisma.user.findMany({ where: { email: { in: [adminEmail, coachEmail] } }, select: { id: true } })).map((u) => u.id);
    await prisma.termsAcceptance.deleteMany({ where: { userId: { in: ids } } });
    await prisma.centerUser.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.center.deleteMany({ where: { subscriberAccountId: accountId } });
    await prisma.subscriberAccount.deleteMany({ where: { id: accountId } });
    await prisma.$disconnect();
  });

  /** Every centerId in the response, at any depth. */
  function centerIds(body) {
    const out = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if (k === "centerId" && typeof x === "string") out.add(x);
          else walk(x);
        }
      }
    };
    walk(body);
    return out;
  }

  test("billing stays inside each account", async ({ request }) => {
    // Client sheet 10-29 (8), row 14: a subscriber's billing showed in Ameris
    // Academy's account. Admins could read any center's billing by its id.
    const academy = await prisma.center.findFirst({ where: { subscriberAccount: { accountNumber: "C-1001" } }, select: { id: true } });
    const month = new Date().toISOString().slice(0, 7);
    const lists = (id) => [`/api/v1/billing/parents?centerId=${id}`, `/api/v1/billing/charges?centerId=${id}`, `/api/v1/billing/invoices?centerId=${id}&month=${month}`];
    const academyAdmin = await getAuthCookie(request, "admin@demo.com", "adminpass");
    for (const url of lists(centerId)) expect((await request.get(url, { headers: { cookie: academyAdmin } })).status(), url).toBe(403);
    const subAdmin = await getAuthCookie(request, adminEmail, password);
    for (const url of lists(academy?.id)) expect((await request.get(url, { headers: { cookie: subAdmin } })).status(), url).toBe(403);
    // Their own center still works.
    expect((await request.get(lists(centerId)[0], { headers: { cookie: subAdmin } })).status()).toBe(200);
  });

  test("Staff Professional Development stays inside each account", async ({ request }) => {
    // Client sheet 10-29 (9), row 7: a subscriber's Staff Progress showed Ameris
    // Academy's employees. Admins could read any center's training by its id.
    const academy = await prisma.center.findFirst({ where: { subscriberAccount: { accountNumber: "C-1001" } }, select: { id: true } });
    const urls = (id) => [`/api/v1/training/progress?centerId=${id}`, `/api/v1/training/items?centerId=${id}`, `/api/v1/training/pathways?centerId=${id}`];
    const subAdmin = await getAuthCookie(request, adminEmail, password);
    for (const url of urls(academy?.id)) expect((await request.get(url, { headers: { cookie: subAdmin } })).status(), url).toBe(403);
    const academyAdmin = await getAuthCookie(request, "admin@demo.com", "adminpass");
    for (const url of urls(centerId)) expect((await request.get(url, { headers: { cookie: academyAdmin } })).status(), url).toBe(403);
    // Their own center still works.
    expect((await request.get(urls(centerId)[0], { headers: { cookie: subAdmin } })).status()).toBe(200);
  });

  test("curriculum can't be changed in another account's center", async ({ request }) => {
    // Found while moving the banks to Global admin (client sheet 10-29 (9),
    // rows 4/5): several curriculum APIs didn't check the center at all.
    const academy = await prisma.center.findFirst({ where: { subscriberAccount: { accountNumber: "C-1001" } }, select: { id: true } });
    const lesson = await prisma.lesson.create({ data: { centerId: academy.id, title: `QA iso lesson ${stamp}` } });
    const category = await prisma.lessonCategory.create({ data: { centerId: academy.id, name: `QA iso category ${stamp}` } });
    const option = await prisma.curriculumOption.create({ data: { centerId: academy.id, kind: "SUBJECT", name: `QA iso subject ${stamp}` } });
    try {
      const sub = await getAuthCookie(request, adminEmail, password);
      const call = (method, url, data) => request.fetch(url, { method, headers: { cookie: sub }, ...(data ? { data } : {}) });
      expect((await call("POST", "/api/v1/lessons", { centerId: academy.id, title: "QA not mine" })).status()).toBe(403);
      expect((await call("PUT", `/api/v1/lessons/${lesson.id}`, { title: "QA changed" })).status()).toBe(403);
      expect((await call("DELETE", `/api/v1/lessons/${lesson.id}`)).status()).toBe(403);
      expect((await call("POST", `/api/v1/lessons/${lesson.id}/goals`, { title: "QA goal" })).status()).toBe(403);
      expect((await call("PUT", `/api/v1/lesson-categories/${category.id}`, { name: "QA changed" })).status()).toBe(403);
      expect((await call("POST", "/api/v1/curriculum-options", { centerId: academy.id, kind: "SUBJECT", name: "QA not mine" })).status()).toBe(403);
      expect((await call("PATCH", `/api/v1/curriculum-options?id=${option.id}`, { name: "QA changed" })).status()).toBe(403);
      expect((await call("DELETE", `/api/v1/curriculum-options?id=${option.id}`)).status()).toBe(403);
      expect((await call("POST", "/api/v1/lessons/import-steps", { centerId: academy.id, rows: [{ line: 2, title: "QA" }] })).status()).toBe(403);
      // The steps library import no longer runs on every center.
      expect((await call("POST", "/api/v1/import/steps-library", {})).status()).toBe(400);
      expect((await prisma.lesson.findUnique({ where: { id: lesson.id } }))?.title).toBe(`QA iso lesson ${stamp}`);
      expect((await prisma.curriculumOption.findUnique({ where: { id: option.id } }))?.name).toBe(`QA iso subject ${stamp}`);
    } finally {
      await prisma.lesson.deleteMany({ where: { id: lesson.id } });
      await prisma.lessonCategory.deleteMany({ where: { id: category.id } });
      await prisma.curriculumOption.deleteMany({ where: { id: option.id } });
    }
  });

  for (const [who, email, lists] of [
    ["admin", adminEmail, [...LISTS, ...ADMIN_ONLY]],
    ["coach", coachEmail, LISTS],
  ]) {
    test(`a new subscriber's ${who} sees only their own center`, async ({ request }) => {
      const cookie = await getAuthCookie(request, email, password);
      // Ameris Academy (C-1001) has data in these lists; none of it may show.
      const academyChildren = await prisma.child.count({ where: { center: { subscriberAccount: { accountNumber: "C-1001" } } } });
      expect(academyChildren).toBeGreaterThan(0);
      for (const url of lists) {
        const res = await request.get(url, { headers: { cookie } });
        if (res.status() === 403 || res.status() === 400) continue; // not their page, or it needs a center picked
        expect(res.status(), `${url}: ${await res.text()}`).toBe(200);
        const foreign = [...centerIds(await res.json())].filter((id) => id !== centerId);
        expect(foreign, `${url} returned another account's centers`).toEqual([]);
      }
    });
  }
});
