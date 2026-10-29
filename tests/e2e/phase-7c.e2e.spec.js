// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin } = require("../helpers/auth");
const { apiPost } = require("../helpers/api");
const { loginViaApi, waitForLoadingDone } = require("../helpers/e2e");

const prisma = new PrismaClient();
const pad = (n) => String(n).padStart(2, "0");
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Phase 7c pages: Character Guide, the Daily Log's guide-driven Course
// Correction and IPP, and Parent Involvement for parents, admins and HR.
test.describe("Phase 7c pages", () => {
  test.describe.configure({ mode: "serial", timeout: 120000 });
  const stamp = Date.now();
  let demoCenter;
  let event;

  test.beforeAll(async ({ request }) => {
    demoCenter = await prisma.center.findFirst({ where: { name: "Demo Center" } });
    const created = await apiPost(request, `/api/v1/parent-involvement/activities?centerId=${demoCenter.id}`, {
      title: `QA Fall Picnic ${stamp}`,
      description: "Outdoor picnic and games",
      date: inDays(10),
      startTime: "16:00",
      endTime: "17:30",
      location: "Playground",
      audience: ["ALL"],
      roles: [{ name: "Setup", description: "Tables and chairs", needed: 2 }],
    }, await loginAsAdmin(request));
    expect(created.status(), await created.text()).toBe(201);
    event = await created.json();
  });

  test.afterAll(async () => {
    await prisma.characterBehavior.deleteMany({ where: { name: { startsWith: `QA Tree ${stamp}` } } });
    await prisma.characterCategory.deleteMany({ where: { name: `QA Cat ${stamp}` } });
    await prisma.activityLog.deleteMany({ where: { notes: `QA guide log ${stamp}` } });
    if (event) {
      await prisma.parentInvolvement.deleteMany({ where: { activityId: event.id } });
      await prisma.parentInvolvementActivity.delete({ where: { id: event.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("admins add a decision tree and a category", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaApi(page, request, "admin@demo.com", "adminpass");
    await page.goto("/admin/character-guide");
    await waitForLoadingDone(page);
    await expect(page.getByRole("button", { name: "Child Hits Another Child", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Categories" }).click();
    await page.getByLabel("New category name").fill(`QA Cat ${stamp}`);
    await page.getByLabel("New category description").fill("Testing");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByLabel(`QA Cat ${stamp} name`)).toBeVisible();

    await page.getByRole("tab", { name: "Decision Trees" }).click();
    await page.getByRole("button", { name: "+ Add Behavior" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Behavior" });
    await dialog.getByLabel("Category").selectOption({ label: `QA Cat ${stamp}` });
    await dialog.getByLabel("Behavior Name").fill(`QA Tree ${stamp}`);
    await dialog.getByLabel("Description").fill("Child throws toys");
    await dialog.getByLabel("Branch 1 title").fill("Frustration");
    await dialog.getByLabel("Frustration 1st Offense steps").fill("Name the feeling.\nOffer a calm space.");
    await dialog.getByRole("button", { name: "+ Add Offense" }).click();
    await dialog.getByLabel("Frustration 2nd Offense steps").fill("Loss of preferred item (5 minutes).");
    await dialog.getByRole("button", { name: "Save Behavior" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: `QA Tree ${stamp}`, exact: true })).toBeVisible();
    const saved = await prisma.characterBehavior.findFirst({ where: { name: `QA Tree ${stamp}` } });
    expect(saved.tree.branches[0].offenses.map((o) => o.steps)).toEqual([["Name the feeling.", "Offer a calm space."], ["Loss of preferred item (5 minutes)."]]);
  });

  test("teachers follow the guide's steps for a Course Correction and see the IPP options", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginViaApi(page, request, "teacher@demo.com", "teacherpass");
    await page.goto(`/teacher/logs?centerId=${demoCenter.id}`);
    await waitForLoadingDone(page);
    await expect(page.getByText(/Teachers can set the time/)).toHaveCount(0);
    await page.locator("label").filter({ hasText: "Child One" }).getByRole("checkbox").check();

    await page.getByRole("button", { name: "Course Correction", exact: true }).click();
    await expect(page.getByText(/^Level$/)).toHaveCount(0);
    await page.getByLabel("Course correction type").selectOption({ label: "Physical Aggression" });
    await page.getByLabel("Behavior", { exact: true }).selectOption({ label: "Child Hits Another Child" });
    await page.getByLabel("Reason").selectOption({ label: "Conflict Over Item" });
    await page.getByLabel("Offense").selectOption({ label: "2nd Offense" });
    const steps = page.getByRole("list", { name: "Steps to follow" });
    await expect(steps).toContainText("Separate the children.");
    await expect(steps).toContainText("Practice sharing and turn-taking.");
    await page.getByLabel("Location").fill("Block center");
    await page.locator("textarea").last().fill(`QA guide log ${stamp}`);
    await page.getByRole("button", { name: "Log Activity" }).click();
    await expect.poll(async () => (await prisma.activityLog.findFirst({ where: { notes: `QA guide log ${stamp}` } }))?.details).toMatchObject({
      behaviorName: "Child Hits Another Child",
      branchTitle: "Conflict Over Item",
      offense: 2,
      location: "Block center",
    });

    await page.getByRole("button", { name: "IPP", exact: true }).click();
    await expect(page.getByLabel("Primary Concern")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Request" })).toBeVisible();
    await page.getByRole("radio", { name: "Log IPP" }).click();
    await expect(page.getByRole("button", { name: "Log IPP" })).toBeVisible();
  });

  test("parents sign up for a role and log signed volunteer time", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginViaApi(page, request, "parent@demo.com", "parentpass");
    await page.goto("/parent/involvement");
    await waitForLoadingDone(page);
    await page.getByRole("button", { name: `Sign up for QA Fall Picnic ${stamp}` }).click();
    const dialog = page.getByRole("dialog", { name: "Sign Up for Volunteer Opportunity" });
    await dialog.getByLabel("Volunteer Role").selectOption({ index: 1 });
    await dialog.locator("#signup-children").click();
    await dialog.getByLabel("Child One").check();
    await dialog.getByRole("button", { name: "Sign Up" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(`You're signed up for QA Fall Picnic ${stamp}`)).toBeVisible();

    await page.getByLabel("Activity").selectOption(event.id);
    await page.locator("#log-children").click();
    await page.getByLabel("Child One").check();
    await page.getByLabel("Date").fill(inDays(-1));
    await page.getByPlaceholder("Add any additional details...").fill("Brought snacks");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText(/type your full name to sign/)).toBeVisible();
    await page.getByRole("checkbox", { name: /I certify/ }).check();
    await page.getByLabel(/E-Signature/).fill("Pat Parent");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Involvement logged. Thank you!")).toBeVisible();
    const logged = await prisma.parentInvolvement.findFirst({ where: { activityId: event.id, kind: "LOG" } });
    expect(logged.signature).toMatchObject({ signedName: "Pat Parent" });
  });

  test("admins edit an event from the list and see the signed volunteer time; HR has no tracking", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginViaApi(page, request, "admin@demo.com", "adminpass");
    await page.goto(`/admin/parent-involvement?centerId=${demoCenter.id}`);
    await waitForLoadingDone(page);
    await page.getByRole("button", { name: `Open QA Fall Picnic ${stamp}` }).click();
    await expect(page.getByRole("heading", { name: "Edit Event" })).toBeVisible();
    await expect(page.getByLabel("Event Name")).toHaveValue(`QA Fall Picnic ${stamp}`);
    await page.getByLabel("Location").fill("Main Room");
    await page.getByRole("button", { name: "Save Event" }).click();
    await expect(page.getByText("Event updated.")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Volunteer Tracking" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Brought snacks" })).toContainText("Pat Parent");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^volunteer-tracking-/);

    await loginViaApi(page, request, "hr@demo.com", "hrpass");
    await page.goto(`/staff/hr/parent-involvement?centerId=${demoCenter.id}`);
    await waitForLoadingDone(page);
    await expect(page.getByRole("heading", { name: "Parent Involvement" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Volunteer Tracking" })).toHaveCount(0);
  });
});
