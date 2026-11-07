// @ts-check
// Authorized Pickup "Search for existing person" also finds people already in
// the system: the center's staff and its children's parents (client sheet
// 2026-11-07).
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiGet, pickDemoCenterId } = require("../helpers/api");

test.describe("Authorized pickup search @api", () => {
  test("finds staff and parents of the center as users", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const centerId = pickDemoCenterId(await (await apiGet(request, "/api/v1/centers", admin)).json());

    const teacherRows = await (await apiGet(request, `/api/v1/pickup-people?centerId=${centerId}&q=teacher`, admin)).json();
    expect(teacherRows.some((r) => r.source === "USER" && r.email === "teacher@demo.com")).toBe(true);
    const parentRows = await (await apiGet(request, `/api/v1/pickup-people?centerId=${centerId}&q=parent@demo`, admin)).json();
    expect(parentRows.some((r) => r.source === "USER" && r.email === "parent@demo.com")).toBe(true);

    // Still admins only.
    expect((await apiGet(request, `/api/v1/pickup-people?centerId=${centerId}&q=teacher`, await loginAsTeacher(request))).status()).toBe(403);
  });
});
