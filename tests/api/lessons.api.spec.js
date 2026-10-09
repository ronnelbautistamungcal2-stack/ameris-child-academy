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

test.describe("Lessons API prior/next steps and age @api", () => {
  let centerId;
  const created = [];

  async function createStep(request, cookies, body) {
    const res = await apiPost(request, "/api/v1/lessons", { centerId, ...body }, cookies);
    const data = await res.json();
    if (res.status() === 201) created.push(data.id);
    return { res, data };
  }

  test.beforeAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/centers", cookies);
    const centers = res.status() === 200 ? await res.json() : [];
    centerId = Array.isArray(centers) && centers.length > 0 ? centers[0].id : null;
  });

  test.afterAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    for (const id of created) await apiDelete(request, `/api/v1/lessons/${id}`, cookies);
  });

  test("saves age and prior/next links, validates them, and clears a link when its step is deleted", async ({ request }) => {
    if (!centerId) test.skip();
    const cookies = await loginAsAdmin(request);
    const suffix = Date.now();

    const { data: prior } = await createStep(request, cookies, { title: `QA Prior Step ${suffix}` });
    const { data: next } = await createStep(request, cookies, { title: `QA Next Step ${suffix}` });
    const { res, data: step } = await createStep(request, cookies, {
      title: `QA Middle Step ${suffix}`,
      ageYears: 2,
      ageMonths: 6,
      priorStepId: prior.id,
      nextStepId: next.id,
    });
    expect(res.status()).toBe(201);
    expect(step.ageYears).toBe(2);
    expect(step.ageMonths).toBe(6);
    expect(step.priorStep.title).toBe(`QA Prior Step ${suffix}`);
    expect(step.nextStep.title).toBe(`QA Next Step ${suffix}`);

    const invalid = [
      { priorStepId: step.id },
      { priorStepId: next.id, nextStepId: next.id },
      { priorStepId: "nonexistent-step" },
      { ageYears: 13 },
      { ageMonths: 0 },
    ];
    for (const body of invalid) {
      const bad = await apiPut(request, `/api/v1/lessons/${step.id}`, body, cookies);
      expect(bad.status(), JSON.stringify(body)).toBe(400);
    }

    // A PUT that omits the fields leaves them alone.
    const renamed = await apiPut(request, `/api/v1/lessons/${step.id}`, { title: `QA Middle Step ${suffix} v2` }, cookies);
    expect(renamed.status()).toBe(200);
    const renamedData = await renamed.json();
    expect(renamedData.ageMonths).toBe(6);
    expect(renamedData.priorStepId).toBe(prior.id);

    const del = await apiDelete(request, `/api/v1/lessons/${prior.id}`, cookies);
    expect(del.status()).toBe(204);
    created.splice(created.indexOf(prior.id), 1);
    const after = await (await apiGet(request, `/api/v1/lessons/${step.id}`, cookies)).json();
    expect(after.priorStepId).toBeNull();
    expect(after.nextStepId).toBe(next.id);
  });
});
