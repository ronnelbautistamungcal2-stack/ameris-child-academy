// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

test.describe("Parent FAQs API @api", () => {
  let createdId;

  test("GET /api/v1/parent-faqs returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/parent-faqs");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/parent-faqs returns 200 for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/parent-faqs", cookies);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("GET /api/v1/parent-faqs returns 200 for parent", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, "/api/v1/parent-faqs", cookies);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("POST /api/v1/parent-faqs returns 400 without a question and answer", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/parent-faqs", { question: "Only a question" }, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/parent-faqs returns 403 for parents", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPost(
      request,
      "/api/v1/parent-faqs",
      { question: "Can parents write FAQs?", answer: "No." },
      cookies,
    );
    expect(res.status()).toBe(403);
  });

  test("POST /api/v1/parent-faqs creates a question for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/parent-faqs",
      {
        question: "E2E What time does late pickup start?",
        answer: "Late pickup fees begin at 6:15pm.",
        topic: "pickup",
      },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    createdId = data.id;
    expect(data.topic).toBe("pickup");
    expect(data.published).toBe(true);
  });

  test("POST /api/v1/parent-faqs falls back to the general topic", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/parent-faqs",
      { question: "E2E Unknown topic question", answer: "An answer.", topic: "not-a-topic" },
      cookies,
    );
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.topic).toBe("general");
    await apiDelete(request, `/api/v1/parent-faqs/${data.id}`, cookies);
  });

  test("published questions are visible to parents", async ({ request }) => {
    test.skip(!createdId, "No FAQ was created");
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, "/api/v1/parent-faqs", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.some((f) => f.id === createdId)).toBe(true);
  });

  test("PUT /api/v1/parent-faqs/:id unpublishes and hides the question from parents", async ({ request }) => {
    test.skip(!createdId, "No FAQ was created");
    const adminCookies = await loginAsAdmin(request);
    const res = await apiPut(
      request,
      `/api/v1/parent-faqs/${createdId}`,
      { published: false },
      adminCookies,
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).published).toBe(false);

    const parentCookies = await loginAsParent(request);
    const parentRes = await apiGet(request, "/api/v1/parent-faqs", parentCookies);
    const data = await parentRes.json();
    expect(data.some((f) => f.id === createdId)).toBe(false);
  });

  test("PUT /api/v1/parent-faqs/:id returns 403 for parents", async ({ request }) => {
    test.skip(!createdId, "No FAQ was created");
    const cookies = await loginAsParent(request);
    const res = await apiPut(
      request,
      `/api/v1/parent-faqs/${createdId}`,
      { question: "Rewritten by a parent" },
      cookies,
    );
    expect(res.status()).toBe(403);
  });

  test("PUT /api/v1/parent-faqs/:id rejects an empty answer", async ({ request }) => {
    test.skip(!createdId, "No FAQ was created");
    const cookies = await loginAsAdmin(request);
    const res = await apiPut(request, `/api/v1/parent-faqs/${createdId}`, { answer: "   " }, cookies);
    expect(res.status()).toBe(400);
  });

  test("DELETE /api/v1/parent-faqs/:id removes the question", async ({ request }) => {
    test.skip(!createdId, "No FAQ was created");
    const cookies = await loginAsAdmin(request);
    const res = await apiDelete(request, `/api/v1/parent-faqs/${createdId}`, cookies);
    expect(res.status()).toBe(200);

    const check = await apiGet(request, `/api/v1/parent-faqs/${createdId}`, cookies);
    expect(check.status()).toBe(404);
  });
});
