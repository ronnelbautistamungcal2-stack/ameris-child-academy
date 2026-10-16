// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsParent, loginAsKitchenStaff } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete, pickDemoCenterId } = require("../helpers/api");

// Mondays far in the future so the tests never touch a real week's menu.
const WEEK = "2099-06-01";
const NEXT_WEEK = "2099-06-08";
const MONTH_LATER = "2099-07-06";
const line = (overrides = {}) => ({
  date: WEEK,
  meal: "lunch",
  ageGroup: "children",
  component: "vegetable",
  item: "E2E Steamed Broccoli",
  ...overrides,
});

test.describe("Menus API @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;
  let tempCenterId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = pickDemoCenterId(await (await apiGet(request, "/api/v1/centers", admin)).json());
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const items = [WEEK, NEXT_WEEK, MONTH_LATER].flatMap((date) =>
      ["vegetable", "fruit"].map((component) => line({ date, component, item: "" })),
    );
    items.push(line({ date: "2099-06-03", meal: "breakfast", ageGroup: "olderInfants", component: "grain", item: "" }));
    await apiPut(request, "/api/v1/menus", { centerId, items }, admin);
    await apiPut(request, "/api/v1/menus", { centerId, kind: "SERVED", items: [line({ item: "" })] }, admin);
    if (tempCenterId) await apiDelete(request, `/api/v1/centers/${tempCenterId}`, admin);
  });

  test("GET /api/v1/menus returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, `/api/v1/menus?start=${WEEK}`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/menus returns 400 for a bad start date", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/menus?start=2099-02-30", cookies);
    expect(res.status()).toBe(400);
  });

  test("PUT /api/v1/menus returns 403 for parents", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPut(request, "/api/v1/menus", { centerId, items: [line()] }, cookies);
    expect(res.status()).toBe(403);
  });

  test("PUT /api/v1/menus rejects a component the meal does not have", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    // Breakfast for 1–12 years has no Meat/Meat Alternate line.
    const res = await apiPut(
      request,
      "/api/v1/menus",
      { centerId, items: [line({ meal: "breakfast", component: "meatOrAlternate" })] },
      cookies,
    );
    expect(res.status()).toBe(400);
  });

  test("admin saves lines and parents can read them", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const save = await apiPut(
      request,
      "/api/v1/menus",
      {
        centerId,
        items: [
          line(),
          line({ date: "2099-06-03", meal: "breakfast", ageGroup: "olderInfants", component: "grain", item: "E2E Oat Cereal" }),
        ],
      },
      admin,
    );
    expect(save.status()).toBe(200);

    const parent = await loginAsParent(request);
    const res = await apiGet(request, `/api/v1/menus?centerId=${centerId}&start=${WEEK}&days=5`, parent);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.center.id).toBe(centerId);
    expect(data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: WEEK, meal: "lunch", component: "vegetable", kind: "PLANNED", item: "E2E Steamed Broccoli" }),
        expect.objectContaining({ date: "2099-06-03", meal: "breakfast", item: "E2E Oat Cereal" }),
      ]),
    );
  });

  test("kitchen staff record what was served, but cannot change the plan", async ({ request }) => {
    const kitchen = await loginAsKitchenStaff(request);
    const plan = await apiPut(request, "/api/v1/menus", { centerId, kind: "PLANNED", items: [line({ item: "Nope" })] }, kitchen);
    expect(plan.status()).toBe(403);

    const served = await apiPut(request, "/api/v1/menus", { centerId, kind: "SERVED", items: [line({ item: "E2E Green Beans" })] }, kitchen);
    expect(served.status()).toBe(200);

    const mine = await (await apiGet(request, `/api/v1/menus?centerId=${centerId}&start=${WEEK}`, kitchen)).json();
    const vegetable = mine.items.filter((i) => i.date === WEEK && i.meal === "lunch" && i.component === "vegetable");
    expect(vegetable.map((i) => [i.kind, i.item]).sort()).toEqual([
      ["PLANNED", "E2E Steamed Broccoli"],
      ["SERVED", "E2E Green Beans"],
    ]);

    // Parents only ever see the planned menu.
    const parent = await loginAsParent(request);
    const theirs = await (await apiGet(request, `/api/v1/menus?centerId=${centerId}&start=${WEEK}`, parent)).json();
    expect(theirs.items.every((i) => i.kind === "PLANNED")).toBe(true);
  });

  test("copy fills only empty lines from the previous week and month", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    // Next week already has its own vegetable; the copy must keep it.
    await apiPut(request, "/api/v1/menus", { centerId, items: [line({ date: NEXT_WEEK, item: "E2E Carrots" })] }, admin);
    await apiPut(request, "/api/v1/menus", { centerId, items: [line({ component: "fruit", item: "E2E Pears" })] }, admin);

    const week = await apiPost(request, "/api/v1/menus/copy", { centerId, start: NEXT_WEEK, from: "week" }, admin);
    expect(week.status()).toBe(200);
    expect(await week.json()).toMatchObject({ copied: 2, sourceStart: WEEK });

    const next = await (await apiGet(request, `/api/v1/menus?centerId=${centerId}&start=${NEXT_WEEK}`, admin)).json();
    const byComponent = Object.fromEntries(
      next.items.filter((i) => i.date === NEXT_WEEK && i.meal === "lunch").map((i) => [i.component, i.item]),
    );
    expect(byComponent).toEqual({ vegetable: "E2E Carrots", fruit: "E2E Pears" });

    // Four weeks before Monday July 6 is Monday June 8, in the previous month.
    const month = await apiPost(request, "/api/v1/menus/copy", { centerId, start: MONTH_LATER, from: "month" }, admin);
    expect(month.status()).toBe(200);
    expect((await month.json()).sourceStart).toBe(NEXT_WEEK);

    const bad = await apiPost(request, "/api/v1/menus/copy", { centerId, start: "2099-06-02", from: "week" }, admin);
    expect(bad.status()).toBe(400);
    const kitchen = await loginAsKitchenStaff(request);
    const denied = await apiPost(request, "/api/v1/menus/copy", { centerId, start: NEXT_WEEK, from: "week" }, kitchen);
    expect(denied.status()).toBe(403);
  });

  test("the center's meals and age groups decide the tabs and rows", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const created = await apiPost(
      request,
      "/api/v1/centers",
      {
        name: `QA Menu Center ${Date.now()}`,
        meals: { breakfast: { provided: true }, lunch: { provided: true } },
        mealAgeGroups: [{ fromMonths: 0, toMonths: 11 }, { fromMonths: 12, toMonths: 36 }, { fromMonths: 48, toMonths: 144 }],
      },
      admin,
    );
    expect(created.status()).toBe(201);
    tempCenterId = (await created.json()).id;

    const data = await (await apiGet(request, `/api/v1/menus?centerId=${tempCenterId}&start=${WEEK}`, admin)).json();
    expect(data.meals).toEqual(["breakfast", "lunch"]);
    expect(data.ageGroups.map((g) => g.key)).toEqual(["youngerInfants", "olderInfants", "children-12-36", "children-48-144"]);
    expect(data.ageGroups[2].label).toBe("1–3 Years");

    const dinner = await apiPut(request, "/api/v1/menus", { centerId: tempCenterId, items: [line({ meal: "dinner", ageGroup: "children-12-36" })] }, admin);
    expect(dinner.status()).toBe(400);
    const oldGroup = await apiPut(request, "/api/v1/menus", { centerId: tempCenterId, items: [line()] }, admin);
    expect(oldGroup.status()).toBe(400);
    const ok = await apiPut(request, "/api/v1/menus", { centerId: tempCenterId, items: [line({ ageGroup: "children-48-144" })] }, admin);
    expect(ok.status()).toBe(200);

    // The demo center's menu is separate from this one.
    const demo = await (await apiGet(request, `/api/v1/menus?centerId=${centerId}&start=${WEEK}`, admin)).json();
    expect(demo.items.some((i) => i.ageGroup === "children-48-144")).toBe(false);
  });

  test("a blank item clears the line", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const clear = await apiPut(
      request,
      "/api/v1/menus",
      {
        centerId,
        items: [
          line({ item: "" }),
          line({ component: "fruit", item: "" }),
          line({ date: "2099-06-03", meal: "breakfast", ageGroup: "olderInfants", component: "grain", item: "  " }),
        ],
      },
      admin,
    );
    expect(clear.status()).toBe(200);

    const res = await apiGet(request, `/api/v1/menus?centerId=${centerId}&start=${WEEK}&days=5`, admin);
    const { items } = await res.json();
    expect(items.filter((i) => i.kind === "PLANNED")).toEqual([]);
  });
});
