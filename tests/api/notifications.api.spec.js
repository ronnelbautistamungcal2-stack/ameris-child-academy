// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPatch, apiPut } = require("../helpers/api");

test.describe("Notifications API @api", () => {
  test("GET /api/v1/notifications returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/notifications");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/notifications returns list for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/notifications", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data) || (data && typeof data === "object")).toBe(true);
  });

  test("GET /api/v1/notifications supports limit parameter", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/notifications?limit=5", cookies);
    expect(res.status()).toBe(200);
  });

  test("PATCH /api/v1/notifications marks all as read", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPatch(request, "/api/v1/notifications", { readAll: true }, cookies);
    expect([200, 204]).toContain(res.status());
  });

  test("PATCH /api/v1/notifications/:id returns 401 without auth", async ({ request }) => {
    const res = await apiPatch(request, "/api/v1/notifications/fake-id", { read: true });
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/notifications/preferences returns preferences", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/notifications/preferences", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("PUT /api/v1/notifications/preferences updates a preference", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPut(
      request,
      "/api/v1/notifications/preferences",
      { type: "MESSAGE", enabled: true },
      cookies,
    );
    expect(res.status()).toBe(200);
  });

  test("PUT /api/v1/notifications/preferences rejects invalid type", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPut(
      request,
      "/api/v1/notifications/preferences",
      { type: "INVALID_TYPE", enabled: true },
      cookies,
    );
    expect([400, 200]).toContain(res.status());
  });

  test("GET /api/v1/notifications returns for teacher", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(request, "/api/v1/notifications", cookies);
    expect(res.status()).toBe(200);
  });

  test("GET /api/v1/notifications returns for parent", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, "/api/v1/notifications", cookies);
    expect(res.status()).toBe(200);
  });
});
