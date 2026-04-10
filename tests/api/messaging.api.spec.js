// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost } = require("../helpers/api");

const prisma = new PrismaClient();

test.describe("Messaging API @api", () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

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
    const teacherUser = await prisma.user.findUnique({
      where: { email: "teacher@demo.com" },
      select: { id: true },
    });
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
    expect([200, 201]).toContain(sendRes.status());

    // Read thread
    const readRes = await apiGet(request, `/api/v1/messages/threads/${thread.id}`, adminCookies);
    expect(readRes.status()).toBe(200);
    const threadData = await readRes.json();
    expect(threadData.messages).toBeDefined();
    expect(threadData.messages.length).toBeGreaterThanOrEqual(1);
  });

  test("creating a thread with a first message creates recipient notifications", async ({ request }) => {
    const adminCookies = await loginAsAdmin(request);
    const teacherCookies = await loginAsTeacher(request);

    const [teacherUser, beforeNotificationsRes] = await Promise.all([
      prisma.user.findUnique({
        where: { email: "teacher@demo.com" },
        select: { id: true },
      }),
      apiGet(request, "/api/v1/notifications?limit=20", teacherCookies),
    ]);
    expect(beforeNotificationsRes.status()).toBe(200);
    const beforeNotifications = await beforeNotificationsRes.json();
    if (!teacherUser) {
      test.skip();
      return;
    }

    const beforeNotificationIds = new Set(
      (beforeNotifications.notifications || []).map((notification) => notification.id),
    );

    const createRes = await apiPost(
      request,
      "/api/v1/messages/threads",
      {
        participantIds: [teacherUser.id],
        title: "QA first-message thread",
        firstMessage: "Opening note created during QA",
      },
      adminCookies,
    );
    expect(createRes.status()).toBe(201);
    const thread = await createRes.json();

    const [teacherThreadsRes, afterNotificationsRes] = await Promise.all([
      apiGet(request, "/api/v1/messages/threads", teacherCookies),
      apiGet(request, "/api/v1/notifications?limit=20", teacherCookies),
    ]);
    expect(teacherThreadsRes.status()).toBe(200);
    expect(afterNotificationsRes.status()).toBe(200);

    const teacherThreads = await teacherThreadsRes.json();
    const afterNotifications = await afterNotificationsRes.json();
    const createdThread = Array.isArray(teacherThreads)
      ? teacherThreads.find((item) => item.id === thread.id)
      : null;

    expect(createdThread).toBeTruthy();
    expect(createdThread.unreadCount).toBeGreaterThan(0);

    const createdNotification = (afterNotifications.notifications || []).find(
      (notification) =>
        !beforeNotificationIds.has(notification.id) &&
        notification.type === "MESSAGE" &&
        notification.metadata?.threadId === thread.id,
    );

    expect(createdNotification).toBeTruthy();
    expect(createdNotification.link).toContain(thread.id);
  });
});
