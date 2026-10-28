// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsKitchenStaff, loginAsParent, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Client requests 2026-10-23 on a throwaway center: kitchen Infant Portions,
// the Infant Feeding Report, Meal Production Record, Meal Claim, Milestone
// Progress Report and Child Steps of Progression Report.
test.describe("Food and milestone reports @api", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let kitchen;
  let parent;
  let baby;
  let toddler;
  let stepA;
  let stepB;
  const day = "2026-09-01";
  const at = (time) => new Date(`${day}T${time}:00`);

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Food Reports ${Date.now()}` }, admin)).json();
    [kitchen, parent] = await Promise.all(["kitchen@demo.com", "parent@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })));
    await prisma.centerUser.create({ data: { userId: kitchen.id, centerId: center.id, role: "KITCHEN_STAFF" } });
    baby = await prisma.child.create({
      data: { firstName: "Mia", lastName: "Turner", birthDate: new Date("2026-02-02T00:00:00Z"), centerId: center.id, feedingPlan: { formula: "Similac" } },
    });
    toddler = await prisma.child.create({
      data: { firstName: "Leo", lastName: "Stone", birthDate: new Date("2024-09-01T00:00:00Z"), centerId: center.id, parentId: parent.id },
    });
    await prisma.activityLog.createMany({
      data: [
        { childId: baby.id, type: "BOTTLE", details: { time: "08:15", amount: "4", consumed: "4" }, createdAt: at("08:15") },
        { childId: baby.id, type: "MEAL", details: { time: "08:38", mealType: "BREAKFAST", meal: "Breakfast" }, createdAt: at("08:38") },
        { childId: toddler.id, type: "MEAL", details: { time: "08:40", mealType: "BREAKFAST", meal: "Breakfast" }, createdAt: at("08:40") },
        { childId: toddler.id, type: "SNACK", details: { time: "15:00", mealType: "PM_SNACK", meal: "PM snack" }, createdAt: at("15:00") },
      ],
    });
    await prisma.menuItem.createMany({
      data: [
        { centerId: center.id, date: new Date(`${day}T00:00:00Z`), meal: "breakfast", ageGroup: "olderInfants", component: "grain", item: "Oatmeal", kind: "SERVED" },
        { centerId: center.id, date: new Date(`${day}T00:00:00Z`), meal: "breakfast", ageGroup: "children", component: "grains", item: "Whole-grain oatmeal", kind: "SERVED" },
      ],
    });

    const category = await prisma.lessonCategory.create({ data: { centerId: center.id, name: "Gross Motor", kind: "STEPS" } });
    // World standard: (6 + 10) / 2 = 8 months; (12 + 12) / 2 = 12 months.
    stepA = await prisma.lesson.create({ data: { centerId: center.id, title: "Crawls", isStep: true, categoryId: category.id, ageMonths: 6, maxAgeMonths: 10 } });
    stepB = await prisma.lesson.create({ data: { centerId: center.id, title: "Walks independently", isStep: true, categoryId: category.id, ageYears: 1, maxAgeYears: 1 } });
    const progress = await prisma.progress.create({ data: { childId: toddler.id, lessonId: stepA.id, status: "PASSED" } });
    // Leo reached Competency on Crawls at about 7 months (2025-04-01).
    await prisma.progressEntry.create({ data: { progressId: progress.id, status: "COMPLETED", occurredAt: new Date("2025-04-01T12:00:00Z") } });
  });

  test.afterAll(async ({ request }) => {
    const ids = [baby?.id, toddler?.id].filter(Boolean);
    await prisma.progressEntry.deleteMany({ where: { progress: { childId: { in: ids } } } });
    await prisma.progress.deleteMany({ where: { childId: { in: ids } } });
    await prisma.activityLog.deleteMany({ where: { childId: { in: ids } } });
    await prisma.infantPortion.deleteMany({ where: { childId: { in: ids } } });
    await prisma.lesson.deleteMany({ where: { centerId: center?.id } });
    await prisma.child.deleteMany({ where: { id: { in: ids } } });
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("kitchen staff record infant portions; teachers cannot", async ({ request }) => {
    const kitchenCookies = await loginAsKitchenStaff(request);
    const qs = `centerId=${center.id}&date=${day}&meal=breakfast&ageGroup=olderInfants`;
    const before = await (await apiGet(request, `/api/v1/menus/infant-portions?${qs}`, kitchenCookies)).json();
    // Mia is 6 months old on Sep 1, so she is in the Older Infants row.
    expect(before.infants.map((i) => i.name)).toEqual(["Mia Turner"]);
    expect(before.components.find((c) => c.key === "grain").item).toBe("Oatmeal");

    const saved = await apiPut(request, "/api/v1/menus/infant-portions", {
      centerId: center.id,
      date: day,
      meal: "breakfast",
      ageGroup: "olderInfants",
      portions: [
        { childId: baby.id, component: "breastMilkOrFormula", amount: "4 oz" },
        { childId: baby.id, component: "grain", amount: "0.5 tbsp" },
      ],
    }, kitchenCookies);
    expect(saved.status(), await saved.text()).toBe(200);
    const summary = await (await apiGet(request, `/api/v1/menus/infant-portions?centerId=${center.id}&start=${day}&days=1&meal=breakfast`, kitchenCookies)).json();
    expect(summary.summary[`${day}|olderInfants`]).toEqual({ recorded: 1, total: 1 });

    expect((await apiGet(request, `/api/v1/menus/infant-portions?${qs}`, await loginAsTeacher(request))).status()).toBe(403);
  });

  test("the infant feeding report joins bottles, meals and kitchen portions", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/reports/infant-feeding?centerId=${center.id}&childId=${baby.id}&from=${day}&to=2026-09-30`, admin);
    expect(res.status(), await res.text()).toBe(200);
    const report = await res.json();
    expect(report.child).toMatchObject({ name: "Mia Turner", formula: "Similac" });
    expect(report.days).toHaveLength(1);
    expect(report.days[0].rows).toEqual([
      expect.objectContaining({ time: "8:15 AM", activity: "Bottle", milk: "Formula", offered: "4", consumed: "4" }),
      expect.objectContaining({ time: "8:38 AM", activity: "Breakfast", components: ["Oatmeal — 0.5 tbsp"] }),
    ]);
    expect((await apiGet(request, `/api/v1/reports/infant-feeding?centerId=${center.id}`, await loginAsKitchenStaff(request))).status()).toBe(403);
  });

  test("meal production counts logged meals and keeps typed planned numbers", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const put = await apiPut(request, "/api/v1/reports/meal-production", { centerId: center.id, meal: "breakfast", date: day, ageGroup: "children", planned: 16 }, admin);
    expect(put.status(), await put.text()).toBe(200);
    const report = await (await apiGet(request, `/api/v1/reports/meal-production?centerId=${center.id}&meal=breakfast&from=${day}&to=2026-09-02`, admin)).json();
    expect(report.rows[0]).toMatchObject({ date: day, components: ["Whole-grain oatmeal"], planned: { children: 16 }, actual: { children: 1 } });
    expect(report.rows[1].actual.children).toBe(0);
  });

  test("meal claim marks each logged meal with a 1 and summarizes the month", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const report = await (await apiGet(request, `/api/v1/reports/meal-claim?centerId=${center.id}&from=${day}&to=2026-09-30`, admin)).json();
    const leo = report.rows.find((r) => r.id === toddler.id);
    expect(leo.cells).toEqual({ [`${day}|breakfast`]: 1, [`${day}|pmSnack`]: 1 });
    expect(leo.age).toBe("2");
    expect(report.rows.find((r) => r.id === baby.id).age).toBe("0.7");
    expect(report.dayTotals[`${day}|breakfast`]).toBe(2);
    expect(report.summary).toMatchObject({ childrenOnRoster: 2, daysAnyMealServed: 1, total: 3 });
    expect(report.summary.meals.find((m) => m.meal === "breakfast")).toMatchObject({ total: 2, days: 1, average: 2 });
  });

  test("milestone progress compares the center average with the world standard", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const report = await (await apiGet(request, `/api/v1/reports/milestone-progress?centerId=${center.id}&date=2026-10-01`, admin)).json();
    const rows = report.categories[0].rows;
    expect(report.categories[0].name).toBe("Gross Motor");
    expect(rows.map((r) => r.title)).toEqual(["Crawls", "Walks independently"]);
    expect(rows[0]).toMatchObject({ worldYears: 0.7, centerYears: 0.6, difference: -0.1, status: "AHEAD", children: 1 });
    expect(rows[1]).toMatchObject({ worldYears: 1, centerYears: null, status: null });
    expect(report.totalChildren).toBe(1);

    // Before Leo crawled there is no center average.
    const earlier = await (await apiGet(request, `/api/v1/reports/milestone-progress?centerId=${center.id}&date=2025-03-01`, admin)).json();
    expect(earlier.categories[0].rows[0].centerYears).toBeNull();
    // The age range filters steps by their world standard.
    const young = await (await apiGet(request, `/api/v1/reports/milestone-progress?centerId=${center.id}&minMonths=0&maxMonths=9`, admin)).json();
    expect(young.categories[0].rows.map((r) => r.title)).toEqual(["Crawls"]);
  });

  test("parents see the steps report for their own child only", async ({ request }) => {
    const parentCookies = await loginAsParent(request);
    const own = await apiGet(request, `/api/v1/reports/child-steps?childId=${toddler.id}&date=2026-10-01`, parentCookies);
    expect(own.status(), await own.text()).toBe(200);
    const report = await own.json();
    expect(report.achievedCount).toBe(1);
    expect(report.categories[0].rows.map((r) => [r.title, r.status])).toEqual([["Crawls", "AHEAD"], ["Walks independently", "NOT_ACHIEVED"]]);
    const notYet = await (await apiGet(request, `/api/v1/reports/child-steps?childId=${toddler.id}&achieved=no`, parentCookies)).json();
    expect(notYet.categories[0].rows.map((r) => r.title)).toEqual(["Walks independently"]);

    expect((await apiGet(request, `/api/v1/reports/child-steps?childId=${baby.id}`, parentCookies)).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/reports/milestone-progress?centerId=${center.id}`, parentCookies)).status()).toBe(403);
  });
});
