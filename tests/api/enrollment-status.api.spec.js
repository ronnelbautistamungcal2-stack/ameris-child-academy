// @ts-check
// Student List > Enrollment Status (client sheet 2026-11-07): dated history;
// the latest entry decides whether the child is still enrolled.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

test.describe("Child enrollment status @api", () => {
  test.describe.configure({ mode: "serial" });
  let center = null;
  let child = null;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Enrollment ${Date.now()}` }, admin)).json();
    child = await prisma.child.create({
      data: { firstName: "Ava", lastName: "Garcia", centerId: center.id, enrollmentStartDate: new Date("2018-10-25T00:00:00Z") },
    });
  });

  test.afterAll(async ({ request }) => {
    if (child?.id) await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("history starts from the enrollment date; Withdrawn ends it and Re-Enrolled reopens it", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const url = `/api/v1/children/${child.id}/enrollment-status`;
    const first = await (await apiGet(request, url, admin)).json();
    expect(first).toMatchObject({ name: "Ava Garcia", entries: [{ date: "2018-10-25", status: "ENROLLED", recordedByName: "System" }] });

    const withdrawn = await apiPut(request, url, { entries: [{ date: "2020-04-30", status: "WITHDRAWN", notes: "Family moved." }] }, admin);
    expect(withdrawn.status(), await withdrawn.text()).toBe(200);
    expect((await withdrawn.json()).entries.map((e) => e.status)).toEqual(["ENROLLED", "WITHDRAWN"]);
    expect((await prisma.child.findUnique({ where: { id: child.id } })).enrollmentEndDate?.toISOString().slice(0, 10)).toBe("2020-04-30");

    await apiPut(request, url, { entries: [{ date: "2021-09-01", status: "RE_ENROLLED" }] }, admin);
    expect((await prisma.child.findUnique({ where: { id: child.id } })).enrollmentEndDate).toBeNull();

    expect((await apiPut(request, url, { entries: [{ date: "2021-09-01", status: "MAYBE" }] }, admin)).status()).toBe(400);
    expect((await apiGet(request, url, await loginAsTeacher(request))).status()).toBe(403);
  });
});
