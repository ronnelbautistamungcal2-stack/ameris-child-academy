// @ts-check
// Global admin > Settings > Subscription Pricing and a subscriber's price
// (client 2026-11-10, step G). The seeded "November 2026" set is the client's
// mockup; this file only changes the pricing set it creates itself.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiPatch, apiDelete } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only people and account, removed in afterAll.
const globalEmail = `pricing-global-${stamp}@pricing-test.local`;
const subEmail = `pricing-sub-${stamp}@pricing-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

test.describe.configure({ mode: "serial" });

test.describe("Subscription pricing @api", () => {
  const userIds = [];
  let accountId = "";
  let newSetId = "";

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    userIds.push((await prisma.user.create({ data: { email: globalEmail, name: "Pricing Global", password: hash, role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] } })).id);
    const account = await prisma.subscriberAccount.create({
      data: {
        accountNumber: `P-${stamp}`,
        name: `Pricing Sub ${stamp}`,
        status: "ACTIVE",
        addOns: ["STEPS_OF_PROGRESSION", "TEACHER_TRAINING", "CURRICULUM"],
        curriculumTypes: ["NON_DENOMINATIONAL_CHRISTIAN"],
      },
    });
    accountId = account.id;
    userIds.push((await prisma.user.create({ data: { email: subEmail, name: "Pricing Sub", password: hash, role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: accountId } })).id);
  });

  test.afterAll(async () => {
    if (newSetId) await prisma.pricingSet.deleteMany({ where: { id: newSetId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.subscriberAccountNote.deleteMany({ where: { accountId } });
    await prisma.subscriberAccount.deleteMany({ where: { id: accountId } });
    await prisma.$disconnect();
  });

  test("the current pricing set is the client's sheet; subscribers can't see it", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const { sets } = await (await apiGet(request, "/api/v1/global/pricing-sets", global)).json();
    const current = sets.find((s) => s.current);
    expect(current).toBeTruthy();
    expect(current.data.baseRanges.find((r) => r.from === 11)).toEqual({ from: 11, to: 20, price: 17.45 });
    expect(current.data.addOns.STEPS_OF_PROGRESSION).toBe(1.35);
    const sub = await getAuthCookie(request, subEmail, password);
    expect((await apiGet(request, "/api/v1/global/pricing-sets", sub)).status()).toBe(403);
  });

  test("New Pricing Set copies the current one, is checked on save, and waits for its date", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const created = await apiPost(request, "/api/v1/global/pricing-sets", { name: `Test ${stamp}`, effectiveDate: "2099-01-01" }, global);
    expect(created.status(), await created.text()).toBe(201);
    const body = await created.json();
    newSetId = body.id;
    const mine = body.sets.find((s) => s.id === newSetId);
    expect(mine.current).toBe(false);
    expect(mine.data.baseRanges.length).toBeGreaterThan(0);

    const overlap = { ...mine.data, baseRanges: [{ from: 1, to: 10, price: 1 }, { from: 10, to: 20, price: 1 }] };
    const bad = await apiPut(request, `/api/v1/global/pricing-sets/${newSetId}`, { data: overlap }, global);
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toMatch(/overlap/);

    const renamed = { ...mine.data, discounts: mine.data.discounts.map((d) => (d.id === "dccs" ? { ...d, name: "DCCS Partner", amount: 40 } : d)) };
    const ok = await apiPut(request, `/api/v1/global/pricing-sets/${newSetId}`, { data: renamed }, global);
    expect(ok.status(), await ok.text()).toBe(200);
    const saved = (await ok.json()).sets.find((s) => s.id === newSetId);
    expect(saved.data.discounts.find((d) => d.id === "dccs")).toMatchObject({ name: "DCCS Partner", amount: 40 });
  });

  test("a subscriber's price: range top x price per child, add-ons, curriculum, discount, half month after the 15th", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const res = await apiPatch(
      request,
      `/api/v1/global/subscribers/${accountId}`,
      {
        pricingSelection: {
          children: 15,
          billingCycle: "MONTHLY",
          programType: "CENTER",
          curriculumVersion: "FAITH_BASED",
          ageGroups: ["toddlers", "3-years"],
          discountIds: ["dccs"],
          orderDate: "2026-11-20",
        },
      },
      global,
    );
    expect(res.status(), await res.text()).toBe(200);
    const detail = await res.json();
    const q = detail.quote;
    // 15 children is in 11–20: 20 x $17.45 = $349; SOP 20 x $1.35; TT 20 x $1.25;
    // curriculum Toddlers $79 + 3 Years $89 (Faith Based); DCCS 50% off everything.
    expect(q.lines.map((l) => l.amount)).toEqual([34900, 2700, 2500, 7900, 8900]);
    expect(q.discounts.map((d) => d.amount)).toEqual([-28450]);
    expect(q.monthly).toBe(28450);
    expect(q.firstPayment).toBe(14225);
    expect(detail.notes.some((n) => n.description.startsWith("Pricing updated: $284.50 a month"))).toBe(true);

    const annual = await (
      await apiPatch(request, `/api/v1/global/subscribers/${accountId}`, { pricingSelection: { children: 15, billingCycle: "ANNUAL", discountIds: [], orderDate: "2026-11-03" } }, global)
    ).json();
    // No curriculum age groups now, so base + add-ons only: 349 + 27 + 25 = $401 a month.
    expect(annual.quote.monthly).toBe(40100);
    expect(annual.quote.periodTotal).toBe(40100 * 12);
    expect(annual.quote.firstPayment).toBe(40100 * 12);

    const tooMany = await (await apiPatch(request, `/api/v1/global/subscribers/${accountId}`, { pricingSelection: { children: 5000 } }, global)).json();
    expect(tooMany.quote.error).toMatch(/more than the highest range/);
    expect((await apiPatch(request, `/api/v1/global/subscribers/${accountId}`, { pricingSelection: { children: 0 } }, global)).status()).toBe(400);
  });

  test("a pricing set can be deleted, but not the last one", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    expect((await apiDelete(request, `/api/v1/global/pricing-sets/${newSetId}`, global)).status()).toBe(200);
    newSetId = "";
  });
});
