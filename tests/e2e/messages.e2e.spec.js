// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsCoach } = require("../helpers/auth");
const { apiPost } = require("../helpers/api");
const { loginViaApi, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();

// Phase 7a Messages: staff use the parent's inbox layout, coaches and admins
// the workflow layout (client mockup 13-02); an open point goes Open -> Ready
// for Review (teacher) -> Completed (coach), and anyone can archive.
test.describe("Messages for staff and coaches", () => {
  test.describe.configure({ mode: "serial" });
  const title = `QA Open Point ${Date.now()}`;
  let threadId;

  test.beforeAll(async ({ request }) => {
    const teacher = await prisma.user.findUnique({ where: { email: "teacher@demo.com" } });
    const res = await apiPost(
      request,
      "/api/v1/messages/threads",
      { participants: [{ id: teacher.id }], threadType: "OPEN_POINT", priority: "A", title, firstMessage: "Please update the bulletin board." },
      await loginAsCoach(request),
    );
    expect(res.status(), await res.text()).toBeLessThan(300);
    threadId = (await res.json()).threads[0].id;
  });

  test.afterAll(async () => {
    if (threadId) await prisma.messageThread.delete({ where: { id: threadId } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("the teacher sees it in the inbox layout and marks it ready for review", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaApi(page, request, "teacher@demo.com", "teacherpass");
    await page.goto(`/teacher/messages?threadId=${threadId}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("tab", { name: /^Inbox/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Archived" })).toBeVisible();
    const pane = page.getByRole("region", { name: "Conversation", exact: true });
    await expect(pane.getByRole("heading", { name: title })).toBeVisible();
    await pane.getByRole("button", { name: "Ready for Review" }).click();
    // The button goes away once the item is saved as ready for review.
    await expect(pane.getByRole("button", { name: "Ready for Review" })).toHaveCount(0);
    await expect(pane.getByText(/Ready for review by/)).toBeVisible();
  });

  test("the coach sees the workflow layout and completes it", async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginViaApi(page, request, "coach@demo.com", "coachpass");
    await page.goto("/coach/messages");
    await waitForLoadingDone(page);
    await expect(page.getByRole("button", { name: /Open Points/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Current/ })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(title) }).click();
    const pane = page.getByRole("region", { name: "Conversation", exact: true });
    await pane.getByRole("button", { name: /Mark as Completed/ }).click();
    await expect(pane.getByRole("button", { name: /Mark as Completed/ })).toHaveCount(0);
    await expect(pane.getByText(/Completed by/)).toBeVisible();
    await page.getByRole("tab", { name: /^Past/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
  });

  test("the teacher can archive it", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaApi(page, request, "teacher@demo.com", "teacherpass");
    await page.goto(`/teacher/messages?threadId=${threadId}`);
    await waitForLoadingDone(page);
    const pane = page.getByRole("region", { name: "Conversation", exact: true });
    await pane.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("tab", { name: "Archived" }).click();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
  });
});
