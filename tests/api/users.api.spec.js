// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete, pickDemoCenterId } = require("../helpers/api");

test.describe("Users API @api", () => {
  let centerId;
  const createdUserIds = [];

  test.beforeAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/centers", cookies);
    if (res.status() === 200) {
      const centers = await res.json();
      centerId = pickDemoCenterId(centers);
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
        middleInitial: "Q",
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
        middleInitial: "Q",
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
        middleInitial: "Q",
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

  test("PUT /api/v1/users/:id changes the user's centers", async ({ request }) => {
    // Client sheet 10-29 (11), row 48: edit the assigned center when editing a user.
    const cookies = await loginAsAdmin(request);
    const centers = await (await apiGet(request, "/api/v1/centers", cookies)).json();
    expect(centers.length).toBeGreaterThan(1);
    const [a, b] = [centerId, centers.find((c) => c.id !== centerId).id];
    const created = await (
      await apiPost(request, "/api/v1/users", { email: `center-user-${Date.now()}@example.com`, name: "Center User", middleInitial: "Q", password: "password123", roles: ["PARENT"], centerId: a }, cookies)
    ).json();
    expect(created.id, JSON.stringify(created)).toBeTruthy();
    createdUserIds.push(created.id);
    const put = (centerIds) => apiPut(request, `/api/v1/users/${created.id}`, { centerIds }, cookies);
    let res = await put([a, b]);
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).centers.map((c) => c.centerId).sort()).toEqual([a, b].sort());
    res = await put([b]);
    expect((await res.json()).centers.map((c) => c.centerId)).toEqual([b]);
    // A center outside the admin's account is refused.
    expect((await put([b, "not-a-center"])).status()).toBe(400);
  });

  test("PUT /api/v1/users/:id lets admin update email", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const createRes = await apiPost(
      request,
      "/api/v1/users",
      {
        email: `editable-user-${Date.now()}@example.com`,
        name: "Editable User",
        password: "password123",
        middleInitial: "Q",
        roles: ["PARENT"],
      },
      cookies,
    );

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    createdUserIds.push(created.id);

    const nextEmail = `updated-user-${Date.now()}@example.com`;
    const updateRes = await apiPut(
      request,
      `/api/v1/users/${created.id}`,
      {
        email: nextEmail,
        name: "Editable User",
      },
      cookies,
    );

    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.email).toBe(nextEmail);
  });
});
