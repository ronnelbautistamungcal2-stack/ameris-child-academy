// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

test.describe("Children API @api", () => {
  let centerId;
  let createdChildId;

  test.beforeAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/centers", cookies);
    if (res.status() === 200) {
      const centers = await res.json();
      centerId = Array.isArray(centers) && centers.length > 0 ? centers[0].id : null;
    }
  });

  test("GET /api/v1/children returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/children");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/children returns 200 for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/children", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/v1/children returns 200 for teacher", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(request, "/api/v1/children", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/v1/children returns 200 for parent (own children)", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, "/api/v1/children", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/v1/children returns 400 without required fields", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/children", {}, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/children returns 400 without centerId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/children", { firstName: "Test" }, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/children creates child with valid data", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/children",
      {
        firstName: "E2E_Test",
        lastName: "Child",
        centerId,
        birthDate: "2023-06-15",
      },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.firstName).toBe("E2E_Test");
    expect(data.lastName).toBe("Child");
    expect(data.centerId).toBe(centerId);
    createdChildId = data.id;
  });

  test("GET /api/v1/children/:id returns 200 for valid ID", async ({ request }) => {
    if (!createdChildId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/children/${createdChildId}`, cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdChildId);
  });

  test("GET /api/v1/children/:id returns 404 for invalid ID", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/children/nonexistent-id-999", cookies);
    expect([404, 400]).toContain(res.status());
  });

  test("PUT /api/v1/children/:id updates child", async ({ request }) => {
    if (!createdChildId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiPut(
      request,
      `/api/v1/children/${createdChildId}`,
      { firstName: "E2E_Updated", allergies: "peanuts" },
      cookies,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.firstName).toBe("E2E_Updated");
  });

  test("PUT /api/v1/children/:id updates document expiration metadata", async ({ request }) => {
    if (!createdChildId) test.skip();
    const cookies = await loginAsAdmin(request);
    const expirationDate = "2026-12-31";

    const updateRes = await apiPut(
      request,
      `/api/v1/children/${createdChildId}`,
      {
        healthAssessmentDocuments: [
          {
            url: "https://example.com/health.pdf",
            originalName: "health.pdf",
            mimeType: "application/pdf",
            size: 1234,
            uploadedAt: new Date().toISOString(),
            documentType: "Health Assessment",
            expirationDate,
          },
        ],
      },
      cookies,
    );
    expect(updateRes.status()).toBe(200);

    const getRes = await apiGet(request, `/api/v1/children/${createdChildId}`, cookies);
    expect(getRes.status()).toBe(200);
    const child = await getRes.json();

    expect(Array.isArray(child.healthAssessmentDocuments)).toBe(true);
    expect(child.healthAssessmentDocuments[0]?.expirationDate).toBe(expirationDate);
  });

  test("POST /api/v1/children returns 403 for parent role", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsParent(request);
    const res = await apiPost(
      request,
      "/api/v1/children",
      { firstName: "Unauthorized", centerId },
      cookies,
    );
    expect(res.status()).toBe(403);
  });

  test("DELETE /api/v1/children/:id removes child", async ({ request }) => {
    if (!createdChildId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiDelete(request, `/api/v1/children/${createdChildId}`, cookies);
    expect(res.status()).toBe(204);
  });
});
