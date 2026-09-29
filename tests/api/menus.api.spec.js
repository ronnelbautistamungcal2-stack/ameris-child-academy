// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPut } = require("../helpers/api");

// A Monday far in the future so the test never touches a real week's menu.
const WEEK = "2099-06-01";
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
    const res = await apiPut(request, "/api/v1/menus", { items: [line()] }, cookies);
    expect(res.status()).toBe(403);
  });

  test("PUT /api/v1/menus rejects a component the meal does not have", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    // Breakfast for 1–12 years has no Meat/Meat Alternate line.
    const res = await apiPut(
      request,
      "/api/v1/menus",
      { items: [line({ meal: "breakfast", component: "meatOrAlternate" })] },
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
        items: [
          line(),
          line({ date: "2099-06-03", meal: "breakfast", ageGroup: "olderInfants", component: "grain", item: "E2E Oat Cereal" }),
        ],
      },
      admin,
    );
    expect(save.status()).toBe(200);

    const parent = await loginAsParent(request);
    const res = await apiGet(request, `/api/v1/menus?start=${WEEK}&days=5`, parent);
    expect(res.status()).toBe(200);
    const { items } = await res.json();
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: WEEK, meal: "lunch", component: "vegetable", item: "E2E Steamed Broccoli" }),
        expect.objectContaining({ date: "2099-06-03", meal: "breakfast", item: "E2E Oat Cereal" }),
      ]),
    );
  });

  test("a blank item clears the line", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const clear = await apiPut(
      request,
      "/api/v1/menus",
      {
        items: [
          line({ item: "" }),
          line({ date: "2099-06-03", meal: "breakfast", ageGroup: "olderInfants", component: "grain", item: "  " }),
        ],
      },
      admin,
    );
    expect(clear.status()).toBe(200);

    const res = await apiGet(request, `/api/v1/menus?start=${WEEK}&days=5`, admin);
    const { items } = await res.json();
    expect(items).toEqual([]);
  });
});
