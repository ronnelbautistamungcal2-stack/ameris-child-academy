// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet } = require("../helpers/api");

test.describe("Analytics API @api", () => {
  let centerId;

  test.beforeAll(async ({ request }) => {
    // Get the first center to use in analytics queries
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/centers", cookies);
    if (res.status() === 200) {
      const centers = await res.json();
      centerId = Array.isArray(centers) && centers.length > 0 ? centers[0].id : null;
    }
  });

  test("GET /api/v1/analytics/overview returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/analytics/overview?centerId=fake");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/analytics/overview requires centerId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/analytics/overview", cookies);
    expect(res.status()).toBe(400);
  });

  test("GET /api/v1/analytics/overview returns data for admin", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/analytics/overview?centerId=${centerId}`, cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test("GET /api/v1/analytics/overview returns data for teacher", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(request, `/api/v1/analytics/overview?centerId=${centerId}`, cookies);
    expect([200, 403]).toContain(res.status());
  });

  test("GET /api/v1/analytics/overview supports date range filters", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const from = "2026-01-01";
    const to = "2026-02-25";
    const res = await apiGet(
      request,
      `/api/v1/analytics/overview?centerId=${centerId}&from=${from}&to=${to}`,
      cookies,
    );
    expect(res.status()).toBe(200);
  });

  test("GET /api/v1/analytics/child-report returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/analytics/child-report?childId=fake");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/analytics/child-report requires childId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/analytics/child-report", cookies);
    expect(res.status()).toBe(400);
  });

  test("GET /api/v1/analytics/teacher-performance returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/analytics/teacher-performance?centerId=fake");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/analytics/teacher-performance requires centerId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/analytics/teacher-performance", cookies);
    expect(res.status()).toBe(400);
  });

  test("GET /api/v1/analytics/teacher-performance returns data for admin", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(
      request,
      `/api/v1/analytics/teacher-performance?centerId=${centerId}`,
      cookies,
    );
    expect(res.status()).toBe(200);
  });

  test("parent cannot access analytics overview", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, `/api/v1/analytics/overview?centerId=${centerId}`, cookies);
    expect(res.status()).toBe(403);
  });
});
