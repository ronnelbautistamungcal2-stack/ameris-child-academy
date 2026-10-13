// @ts-check
const { test, expect } = require("@playwright/test");
const {
  loginAsKitchenStaff,
  loginAsHrStaff,
  loginAsStudentSupport,
  loginAsTeacher,
} = require("../helpers/auth");
const { apiGet, pickDemoCenterId } = require("../helpers/api");

// Kitchen, HR and Student Support staff share the staff portal with Other Staff.
const STAFF_ROLES = [
  { role: "KITCHEN_STAFF", login: loginAsKitchenStaff },
  { role: "HR_STAFF", login: loginAsHrStaff },
  { role: "STUDENT_SUPPORT", login: loginAsStudentSupport },
];

test.describe("Staff portal roles @api", () => {
  for (const { role, login } of STAFF_ROLES) {
    test(`${role} signs in, reaches the staff portal, and can use staff APIs`, async ({ request }) => {
      const cookies = await login(request);

      const session = await (await apiGet(request, "/api/auth/session", cookies)).json();
      expect(session.user.role).toBe(role);

      const page = await request.get("/staff/dashboard", {
        headers: { Cookie: cookies },
        maxRedirects: 0,
      });
      expect(page.status()).toBe(200);

      const metrics = await apiGet(request, "/api/v1/metrics/me", cookies);
      expect(metrics.status()).not.toBe(403);

      const centers = await (await apiGet(request, "/api/v1/centers", cookies)).json();
      const centerId = pickDemoCenterId(centers);
      if (centerId) {
        const today = new Date().toISOString().slice(0, 10);
        const attendance = await apiGet(
          request,
          `/api/v1/staff-attendance?centerId=${centerId}&from=${today}&to=${today}`,
          cookies,
        );
        expect(attendance.status()).toBe(200);
      }
    });
  }

  test("other roles are still kept out of the staff portal", async ({ request }) => {
    const cookies = await loginAsTeacher(request);
    const page = await request.get("/staff/dashboard", {
      headers: { Cookie: cookies },
      maxRedirects: 0,
    });
    expect(page.status()).toBe(307);
    expect(page.headers().location).toContain("/dashboard");
  });
});
