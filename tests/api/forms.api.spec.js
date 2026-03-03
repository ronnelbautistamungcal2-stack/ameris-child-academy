// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");

test.describe("Forms Templates API @api", () => {
  let createdTemplateId;

  test("GET /api/v1/forms/templates returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/forms/templates");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/forms/templates returns 200 for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/forms/templates", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/v1/forms/templates returns 200 for teacher", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(request, "/api/v1/forms/templates", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/v1/forms/templates returns 200 for parent", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, "/api/v1/forms/templates", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/v1/forms/templates returns 400 without required fields", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/forms/templates", {}, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/forms/templates returns 400 without targetRole", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/forms/templates", { title: "Test Form" }, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/forms/templates creates template with valid data", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/forms/templates",
      {
        title: "E2E Test Form Template",
        description: "An automated test form",
        targetRole: "PARENT",
        schema: { fields: [{ name: "field1", type: "text", label: "Field 1" }] },
        active: true,
      },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("E2E Test Form Template");
    expect(data.targetRole).toBe("PARENT");
    createdTemplateId = data.id;
  });

  test("GET /api/v1/forms/templates/:id returns 200 for valid ID", async ({ request }) => {
    if (!createdTemplateId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/forms/templates/${createdTemplateId}`, cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdTemplateId);
  });

  test("GET /api/v1/forms/templates/:id returns 404 for invalid ID", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/forms/templates/nonexistent-id-999", cookies);
    expect([404, 400]).toContain(res.status());
  });

  test("PUT /api/v1/forms/templates/:id updates template", async ({ request }) => {
    if (!createdTemplateId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiPut(
      request,
      `/api/v1/forms/templates/${createdTemplateId}`,
      { title: "E2E Updated Form Template", description: "Updated description" },
      cookies,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("E2E Updated Form Template");
  });

  test("POST /api/v1/forms/templates returns 403 for teacher", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "Unauthorized", targetRole: "PARENT" },
      cookies,
    );
    expect(res.status()).toBe(403);
  });

  test("POST /api/v1/forms/templates returns 403 for parent", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "Unauthorized", targetRole: "PARENT" },
      cookies,
    );
    expect(res.status()).toBe(403);
  });
});
