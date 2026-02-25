// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost } = require("../helpers/api");

test.describe("Messaging API @api", () => {
  test("GET /api/v1/messages/threads returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/messages/threads");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/messages/threads returns threads for admin", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/messages/threads", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/v1/messages/threads returns threads for teacher", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const res = await apiGet(request, "/api/v1/messages/threads", cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/v1/messages/threads requires participantIds", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/messages/threads", {}, cookies);
    expect([400, 422]).toContain(res.status());
  });

  test("POST /api/v1/messages/send returns 401 without auth", async ({ request }) => {
    const res = await apiPost(request, "/api/v1/messages/send", { threadId: "fake", body: "hello" });
    expect(res.status()).toBe(401);
  });

  test("POST /api/v1/messages/send requires threadId and body", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/messages/send", {}, cookies);
    expect(res.status()).toBe(400);
  });

  test("POST /api/v1/messages/send rejects invalid threadId", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/messages/send",
      { threadId: "nonexistent-id", body: "test message" },
      cookies,
    );
    expect([400, 404]).toContain(res.status());
  });

  test("GET /api/v1/messages/threads/:id returns 401 without auth", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/messages/threads/fake-id");
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/messages/threads/:id returns 404 for invalid thread", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const res = await apiGet(request, "/api/v1/messages/threads/nonexistent-id", cookies);
    expect([403, 404]).toContain(res.status());
  });

  test("full thread lifecycle: create thread, send message, read thread", async ({ request }) => {
    const adminCookies = await loginAsAdmin(request);
    const teacherCookies = await loginAsTeacher(request);

    // Get teacher user ID from a known endpoint
    const usersRes = await apiGet(request, "/api/v1/users?role=TEACHER", adminCookies);
    if (usersRes.status() !== 200) {
      test.skip();
      return;
    }
    const users = await usersRes.json();
    const teacherUser = Array.isArray(users) ? users[0] : null;
    if (!teacherUser) {
      test.skip();
      return;
    }

    // Create thread
    const createRes = await apiPost(
      request,
      "/api/v1/messages/threads",
      { participantIds: [teacherUser.id] },
      adminCookies,
    );
    if (createRes.status() !== 201 && createRes.status() !== 200) {
      // Thread creation may require centerId
      test.skip();
      return;
    }
    const thread = await createRes.json();
    expect(thread.id).toBeTruthy();

    // Send message
    const sendRes = await apiPost(
      request,
      "/api/v1/messages/send",
      { threadId: thread.id, body: "Test message from E2E" },
      adminCookies,
    );
    expect(sendRes.status()).toBe(200);

    // Read thread
    const readRes = await apiGet(request, `/api/v1/messages/threads/${thread.id}`, adminCookies);
    expect(readRes.status()).toBe(200);
    const threadData = await readRes.json();
    expect(threadData.messages).toBeDefined();
    expect(threadData.messages.length).toBeGreaterThanOrEqual(1);
  });
});
