// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin } = require("../helpers/auth");
const { apiGet, apiPost, apiDelete } = require("../helpers/api");

test.describe("Users API @api", () => {
  let centerId;
  const createdUserIds = [];

  test.beforeAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/centers", cookies);
    if (res.status() === 200) {
      const centers = await res.json();
      centerId = Array.isArray(centers) && centers.length > 0 ? centers[0].id : null;
    }
  });

  test.afterAll(async ({ request }) => {
    if (!createdUserIds.length) return;
    const cookies = await loginAsAdmin(request);
    for (const id of createdUserIds) {
      await apiDelete(request, `/api/v1/users/${id}`, cookies);
    }
  });

  test("POST /api/v1/users rejects invalid centerId with JSON 400", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/users",
      {
        email: `bad-center-${Date.now()}@example.com`,
        name: "Bad Center",
        password: "password123",
        roles: ["PARENT"],
        centerId: "not-a-real-center",
      },
      cookies,
    );

    expect(res.status()).toBe(400);
    expect(res.headers()["content-type"]).toContain("application/json");
    await expect(res.json()).resolves.toMatchObject({ error: "Invalid centerId" });
  });

  test("POST /api/v1/users rejects passwords shorter than 8 characters", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/users",
      {
        email: `short-password-${Date.now()}@example.com`,
        name: "Short Password",
        password: "1234567",
        roles: ["PARENT"],
      },
      cookies,
    );

    expect(res.status()).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Password must be at least 8 characters",
    });
  });

  test("POST /api/v1/users creates a user with a valid center assignment", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/users",
      {
        email: `valid-user-${Date.now()}@example.com`,
        name: "Valid User",
        password: "password123",
        roles: ["PARENT"],
        centerId,
      },
      cookies,
    );

    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.email).toMatch(/^valid-user-/);
    expect(data.centers).toHaveLength(1);
    expect(data.centers[0].centerId).toBe(centerId);
    createdUserIds.push(data.id);
  });
});
