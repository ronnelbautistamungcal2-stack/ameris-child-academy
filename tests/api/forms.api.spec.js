// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiPatch, apiDelete } = require("../helpers/api");

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

  test("POST /api/v1/forms/templates derives targetRole from the assignment", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "E2E Derived Role Form", assignmentType: "FAMILY" },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.targetRole).toBe("PARENT");
    expect(data.assignmentType).toBe("FAMILY");
    await apiDelete(request, `/api/v1/forms/templates/${data.id}`, cookies);
  });

  test("POST /api/v1/forms/templates returns 400 for a staff assignment with no roles", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "E2E No Roles Form", assignmentType: "STAFF", staffRoles: [] },
      cookies,
    );
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

test.describe("Form Template Assignments API @api", () => {
  test("age group assignment stores its range and stays parent-facing", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/forms/templates",
      {
        title: "E2E Infant Feeding Plan",
        assignmentType: "AGE_GROUP",
        ageMinMonths: 0,
        ageMaxMonths: 18,
        attachmentUrl: "/uploads/e2e-feeding-plan.pdf",
        attachmentName: "feeding-plan.pdf",
        attachmentSize: 2048,
      },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.assignmentType).toBe("AGE_GROUP");
    expect(data.ageMinMonths).toBe(0);
    expect(data.ageMaxMonths).toBe(18);
    expect(data.targetRole).toBe("PARENT");
    expect(data.attachmentName).toBe("feeding-plan.pdf");

    await apiDelete(request, `/api/v1/forms/templates/${data.id}`, cookies);
  });

  test("a due date round-trips and can be cleared", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const created = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "E2E Dated Form", assignmentType: "FAMILY", dueDate: "2026-08-01" },
      cookies,
    );
    expect(created.status()).toBe(201);
    const template = await created.json();
    expect(new Date(template.dueDate).toISOString().slice(0, 10)).toBe("2026-08-01");

    const patched = await apiPatch(
      request,
      `/api/v1/forms/templates/${template.id}`,
      { dueDate: null },
      cookies,
    );
    expect(patched.status()).toBe(200);
    expect((await patched.json()).dueDate).toBeNull();

    await apiDelete(request, `/api/v1/forms/templates/${template.id}`, cookies);
  });

  test("POST returns 400 when the age range is inverted", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "E2E Bad Range", assignmentType: "AGE_GROUP", ageMinMonths: 60, ageMaxMonths: 12 },
      cookies,
    );
    expect(res.status()).toBe(400);
  });

  test("switching a template to staff realigns targetRole", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const created = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "E2E Reassignable Form", assignmentType: "CHILD" },
      cookies,
    );
    expect(created.status()).toBe(201);
    const template = await created.json();
    expect(template.targetRole).toBe("PARENT");

    const patched = await apiPatch(
      request,
      `/api/v1/forms/templates/${template.id}`,
      { assignmentType: "STAFF", staffRoles: ["COACH", "TEACHER"] },
      cookies,
    );
    expect(patched.status()).toBe(200);
    const updated = await patched.json();
    expect(updated.assignmentType).toBe("STAFF");
    expect(updated.staffRoles).toEqual(["TEACHER", "COACH"]);
    // Roles are stored in a fixed order, and targetRole tracks the first of them.
    expect(updated.targetRole).toBe("TEACHER");
    expect(updated.ageMinMonths).toBeNull();

    const removed = await apiDelete(request, `/api/v1/forms/templates/${template.id}`, cookies);
    expect(removed.status()).toBe(204);
  });

  test("DELETE returns 403 for a teacher", async ({ request }) => {
    const adminCookies = await loginAsAdmin(request);
    const created = await apiPost(
      request,
      "/api/v1/forms/templates",
      { title: "E2E Protected Form", assignmentType: "FAMILY" },
      adminCookies,
    );
    const template = await created.json();

    const teacherCookies = await loginAsTeacher(request);
    const res = await apiDelete(request, `/api/v1/forms/templates/${template.id}`, teacherCookies);
    expect(res.status()).toBe(403);

    await apiDelete(request, `/api/v1/forms/templates/${template.id}`, adminCookies);
  });
});
