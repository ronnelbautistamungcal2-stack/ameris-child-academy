// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

test.describe("Lessons API @api", () => {
  let centerId;
  let createdLessonId;

  test.beforeAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/centers", cookies);
    if (res.status() === 200) {
      const centers = await res.json();
      centerId = Array.isArray(centers) && centers.length > 0 ? centers[0].id : null;
    }
  });

  test("GET /api/v1/lessons returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/lessons");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/lessons returns 200 for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/lessons", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/v1/lessons with centerId returns lessons for teacher", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(request, `/api/v1/lessons?centerId=${centerId}`, cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/v1/lessons returns 403 for parent", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, "/api/v1/lessons", cookies);
    expect(res.status()).toBe(403);
  });

  test("GET /api/v1/lessons requires centerId for teacher", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(request, "/api/v1/lessons", cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/lessons returns 400 without required fields", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/lessons", {}, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/lessons returns 400 without centerId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/lessons", { title: "Test Lesson" }, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/lessons creates lesson with valid data", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/lessons",
      {
        title: "E2E Test Lesson",
        description: "A test lesson for automated testing",
        centerId,
        media: ["https://example.com/video.mp4"],
      },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("E2E Test Lesson");
    expect(data.centerId).toBe(centerId);
    createdLessonId = data.id;
  });

  test("POST /api/v1/curriculum/records creates a manual curriculum step", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const suffix = Date.now();
    const res = await apiPost(
      request,
      "/api/v1/curriculum/records",
      {
        centerId,
        lessonTitle: `QA Manual Curriculum ${suffix}`,
        childAge: "3-5",
        term: "Term 1",
        category: "Language",
        subject: "Phonics",
        reference: `QA-${suffix}`,
        progressionStep: `Step ${suffix}`,
        testingQuestion: "Can the child identify the sound?",
      },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.goal.title).toBe(`Step ${suffix}`);
    expect(data.lesson.title).toBe(`QA Manual Curriculum ${suffix}`);
  });

  test("GET /api/v1/lessons/:id returns 200 for valid ID", async ({ request }) => {
    if (!createdLessonId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, `/api/v1/lessons/${createdLessonId}`, cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdLessonId);
  });

  test("GET /api/v1/lessons/:id returns 404 for invalid ID", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/lessons/nonexistent-id-999", cookies);
    expect([404, 400]).toContain(res.status());
  });

  test("PUT /api/v1/lessons/:id updates lesson", async ({ request }) => {
    if (!createdLessonId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiPut(
      request,
      `/api/v1/lessons/${createdLessonId}`,
      { title: "E2E Updated Lesson", description: "Updated description" },
      cookies,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("E2E Updated Lesson");
  });

  test("DELETE /api/v1/lessons/:id removes lesson", async ({ request }) => {
    if (!createdLessonId) test.skip();
    const cookies = await loginAsAdmin(request);
    const res = await apiDelete(request, `/api/v1/lessons/${createdLessonId}`, cookies);
    expect(res.status()).toBe(204);
  });
});
