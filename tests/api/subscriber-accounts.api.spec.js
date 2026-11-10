// @ts-check
// Subscriber accounts (client 2026-11-06): the Global admin creates them, each
// admin only sees their own account's centers and people, add-ons come from
// the account, and center/child limits block adding more.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie, loginAsAdmin } = require("../helpers/auth");
const { apiGet, apiPost, apiPatch, pickDemoCenterId } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only accounts, created here and removed in afterAll.
const globalEmail = `global-${stamp}@subscriber-test.local`;
const subAdminEmail = `sub-admin-${stamp}@subscriber-test.local`;
const globalPassword = crypto.randomBytes(9).toString("base64url");
const subAdminPassword = crypto.randomBytes(9).toString("base64url");

test.describe.configure({ mode: "serial" });

test.describe("Subscriber accounts @api", () => {
  let globalUserId = null;
  let accountId = null;
  let subCenterId = null;
  let demoCenterId = null;

  test.beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: globalEmail,
        name: "Global Test",
        password: await bcrypt.hash(globalPassword, 10),
        role: "GLOBAL_ADMIN",
        roles: ["GLOBAL_ADMIN"],
      },
    });
    globalUserId = user.id;
  });

  test.afterAll(async () => {
    if (accountId) {
      const centers = await prisma.center.findMany({ where: { subscriberAccountId: accountId }, select: { id: true } });
      const centerIds = centers.map((c) => c.id);
      const users = await prisma.user.findMany({ where: { subscriberAccountId: accountId }, select: { id: true } });
      const userIds = users.map((u) => u.id);
      if (centerIds.length) {
        await prisma.child.deleteMany({ where: { centerId: { in: centerIds } } });
        await prisma.centerUser.deleteMany({ where: { centerId: { in: centerIds } } });
      }
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (centerIds.length) await prisma.center.deleteMany({ where: { id: { in: centerIds } } });
      await prisma.subscriberAccount.delete({ where: { id: accountId } });
    }
    if (globalUserId) await prisma.user.delete({ where: { id: globalUserId } });
    await prisma.$disconnect();
  });

  test("a center admin can't reach the Global admin API", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/global/subscribers", cookies);
    expect(res.status()).toBe(403);
    const centers = await (await apiGet(request, "/api/v1/centers", cookies)).json();
    demoCenterId = pickDemoCenterId(centers);
  });

  test("the Global admin creates a pending subscriber with its center and admin", async ({ request }) => {
    const cookies = await getAuthCookie(request, globalEmail, globalPassword);
    const res = await apiPost(
      request,
      "/api/v1/global/subscribers",
      {
        name: `Sunny Test ${stamp}`,
        adminName: "Sub Admin",
        adminEmail: subAdminEmail,
        adminPassword: subAdminPassword,
        addOns: ["STEPS_OF_PROGRESSION", "NOT_AN_ADD_ON"],
        maxCenters: 1,
        maxChildren: 1,
      },
      cookies,
    );
    expect(res.status()).toBe(201);
    const account = await res.json();
    accountId = account.id;
    expect(account.status).toBe("PENDING");
    expect(account.accountNumber).toMatch(/^C-\d{4,}$/);
    expect(account.addOns).toEqual(["STEPS_OF_PROGRESSION"]);

    const list = await (await apiGet(request, "/api/v1/global/subscribers?status=PENDING", cookies)).json();
    expect(list.subscribers.some((s) => s.id === accountId)).toBe(true);
  });

  test("the subscriber admin sees only their own account", async ({ request }) => {
    const cookies = await getAuthCookie(request, subAdminEmail, subAdminPassword);

    const account = await (await apiGet(request, "/api/v1/account", cookies)).json();
    expect(account.addOns).toEqual(["STEPS_OF_PROGRESSION"]);
    expect(account.usage).toMatchObject({ centers: 1, children: 0 });
    expect(account.usage.childrenByCenter).toEqual([expect.objectContaining({ children: 0 })]);

    const centers = await (await apiGet(request, "/api/v1/centers", cookies)).json();
    expect(centers).toHaveLength(1);
    subCenterId = centers[0].id;

    // Another account's center and people are out of reach.
    expect((await apiGet(request, `/api/v1/centers/${demoCenterId}`, cookies)).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/children?centerId=${demoCenterId}`, cookies)).status()).toBe(403);
    const users = await (await apiGet(request, "/api/v1/users", cookies)).json();
    expect(users.map((u) => u.email)).toEqual([subAdminEmail]);
    const demoAdmin = await prisma.user.findUnique({ where: { email: "admin@demo.com" }, select: { id: true } });
    expect((await apiGet(request, `/api/v1/users/${demoAdmin?.id}`, cookies)).status()).toBe(404);
    const search = await (await apiGet(request, "/api/v1/users/search?q=demo", cookies)).json();
    expect(search).toEqual([]);

    // A center admin can't hand out the Global admin role.
    const made = await apiPost(
      request,
      "/api/v1/users",
      { email: `sneaky-${stamp}@subscriber-test.local`, name: "Sneaky", password: "password123", middleInitial: "S", roles: ["ADMIN", "GLOBAL_ADMIN"], centerId: subCenterId },
      cookies,
    );
    expect(made.status()).toBe(201);
    expect((await made.json()).roles).toEqual(["ADMIN"]);
  });

  test("the demo admin no longer sees the subscriber's center", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const centers = await (await apiGet(request, "/api/v1/centers", cookies)).json();
    expect(centers.some((c) => c.id === subCenterId)).toBe(false);
    expect((await apiGet(request, `/api/v1/children?centerId=${subCenterId}`, cookies)).status()).toBe(403);
  });

  test("center and child limits block adding more", async ({ request }) => {
    const cookies = await getAuthCookie(request, subAdminEmail, subAdminPassword);

    const center = await apiPost(request, "/api/v1/centers", { name: "One Too Many" }, cookies);
    expect(center.status()).toBe(409);
    expect((await center.json()).error.code).toBe("CENTER_LIMIT_REACHED");

    const first = await apiPost(request, "/api/v1/children", { firstName: "Limit", lastName: "One", centerId: subCenterId }, cookies);
    expect(first.status()).toBe(201);
    const second = await apiPost(request, "/api/v1/children", { firstName: "Limit", lastName: "Two", centerId: subCenterId }, cookies);
    expect(second.status()).toBe(409);
    expect((await second.json()).error.code).toBe("CHILD_LIMIT_REACHED");

    // The limit is per center (client 2026-11-07): a second center of the
    // same account takes its own child.
    const other = await prisma.center.create({ data: { name: `Second ${stamp}`, subscriberAccountId: accountId } });
    const admin = await prisma.user.findUnique({ where: { email: subAdminEmail }, select: { id: true } });
    await prisma.centerUser.create({ data: { userId: admin.id, centerId: other.id, role: "ADMIN" } });
    const elsewhere = await apiPost(request, "/api/v1/children", { firstName: "Limit", lastName: "Three", centerId: other.id }, cookies);
    expect(elsewhere.status(), await elsewhere.text()).toBe(201);
  });

  test("Global admin changes are saved and logged in Notes", async ({ request }) => {
    const cookies = await getAuthCookie(request, globalEmail, globalPassword);
    const res = await apiPatch(
      request,
      `/api/v1/global/subscribers/${accountId}`,
      { status: "ACTIVE", addOns: ["STEPS_OF_PROGRESSION", "CURRICULUM"], maxChildren: 5, curriculumTypes: ["Faith Based", "OTHER"] },
      cookies,
    );
    expect(res.status()).toBe(200);
    const detail = await res.json();
    expect(detail.status).toBe("ACTIVE");
    expect(detail.activatedAt).toBeTruthy();
    // One child at each of its two centers (the limit is per center).
    expect(detail.childCount).toBe(2);
    expect(detail.curriculumTypes).toEqual(["NON_DENOMINATIONAL_CHRISTIAN", "OTHER"]);
    const notes = detail.notes.map((n) => n.description).join(" | ");
    expect(notes).toContain("Status changed to Active");
    expect(notes).toContain("Add-ons turned on: Curriculum");
    expect(notes).toContain("Child limit set to 5");
    expect(notes).toContain("Curriculum types set to Non-Denominational Christian, Other");

    const bad = await apiPatch(request, `/api/v1/global/subscribers/${accountId}`, { maxCenters: 0 }, cookies);
    expect(bad.status()).toBe(400);
  });
});
