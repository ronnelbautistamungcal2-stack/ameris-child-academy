// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");

test.describe("Staff Management API @api", () => {
  let centerId;
  let teacherUserId;

  test.beforeAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);

    // Get center
    const centersRes = await apiGet(request, "/api/v1/centers", cookies);
    if (centersRes.status() === 200) {
      const centers = await centersRes.json();
      centerId = Array.isArray(centers) && centers.length > 0 ? centers[0].id : null;
    }

    // Get teacher user
    if (centerId) {
      const usersRes = await apiGet(request, `/api/v1/users?centerId=${centerId}&role=TEACHER`, cookies);
      if (usersRes.status() === 200) {
        const users = await usersRes.json();
        teacherUserId = Array.isArray(users) && users.length > 0 ? users[0].id : null;
      }
    }
  });

  // ── Staff Attendance ──────────────────────────────────────────

  test.describe("Staff Attendance", () => {
    test("GET /api/v1/staff-attendance returns 401 without auth", async ({ request }) => {
      const res = await apiGet(request, "/api/v1/staff-attendance?centerId=fake");
      expect(res.status()).toBe(401);
    });

    test("GET /api/v1/staff-attendance returns records for admin", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const today = new Date().toISOString().split("T")[0];
      const res = await apiGet(
        request,
        `/api/v1/staff-attendance?centerId=${centerId}&from=${today}&to=${today}`,
        cookies,
      );
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/v1/staff-attendance creates a record", async ({ request }) => {
      if (!centerId || !teacherUserId) test.skip();
      const cookies = await loginAsAdmin(request);
      const today = new Date().toISOString().split("T")[0];
      const res = await apiPost(
        request,
        "/api/v1/staff-attendance",
        {
          centerId,
          userId: teacherUserId,
          date: today,
          status: "PRESENT",
          clockIn: "08:00",
          clockOut: "17:00",
          lateMinutes: 0,
          notes: "E2E test attendance",
        },
        cookies,
      );
      expect([200, 201]).toContain(res.status());
    });

    test("GET /api/v1/staff-attendance/summary returns monthly summary", async ({ request }) => {
      if (!centerId || !teacherUserId) test.skip();
      const cookies = await loginAsAdmin(request);
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const res = await apiGet(
        request,
        `/api/v1/staff-attendance/summary?centerId=${centerId}&userId=${teacherUserId}&from=${from}`,
        cookies,
      );
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("totalDays");
    });

    test("teacher can view own attendance", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsTeacher(request);
      const today = new Date().toISOString().split("T")[0];
      const res = await apiGet(
        request,
        `/api/v1/staff-attendance?centerId=${centerId}&from=${today}&to=${today}`,
        cookies,
      );
      expect(res.status()).toBe(200);
    });
  });

  // ── Time Off ──────────────────────────────────────────────────

  test.describe("Time Off", () => {
    test("GET /api/v1/time-off returns 401 without auth", async ({ request }) => {
      const res = await apiGet(request, "/api/v1/time-off?centerId=fake");
      expect(res.status()).toBe(401);
    });

    test("GET /api/v1/time-off returns requests for teacher", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsTeacher(request);
      const res = await apiGet(request, `/api/v1/time-off?centerId=${centerId}`, cookies);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/v1/time-off creates a request", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsTeacher(request);
      const startDate = "2026-03-15";
      const endDate = "2026-03-16";
      const res = await apiPost(
        request,
        "/api/v1/time-off",
        {
          centerId,
          type: "PTO",
          startDate,
          endDate,
          reason: "E2E test time off",
        },
        cookies,
      );
      expect([200, 201]).toContain(res.status());
    });

    test("POST /api/v1/time-off rejects invalid dates", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsTeacher(request);
      const res = await apiPost(
        request,
        "/api/v1/time-off",
        {
          centerId,
          type: "PTO",
          startDate: "2026-03-16",
          endDate: "2026-03-15", // end before start
          reason: "Invalid dates test",
        },
        cookies,
      );
      expect(res.status()).toBe(400);
    });

    test("GET /api/v1/time-off/calendar returns calendar data", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const res = await apiGet(
        request,
        `/api/v1/time-off/calendar?centerId=${centerId}&from=2026-02-01&to=2026-02-28`,
        cookies,
      );
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("admin can approve a time-off request", async ({ request }) => {
      if (!centerId) test.skip();

      // Create a request as teacher
      const teacherCookies = await loginAsTeacher(request);
      const createRes = await apiPost(
        request,
        "/api/v1/time-off",
        {
          centerId,
          type: "PTO",
          startDate: "2026-04-01",
          endDate: "2026-04-02",
          reason: "Approval test",
        },
        teacherCookies,
      );
      if (createRes.status() !== 200 && createRes.status() !== 201) {
        test.skip();
        return;
      }
      const created = await createRes.json();

      // Approve as admin
      const adminCookies = await loginAsAdmin(request);
      const approveRes = await apiPut(
        request,
        `/api/v1/time-off/${created.id}`,
        { status: "APPROVED" },
        adminCookies,
      );
      expect(approveRes.status()).toBe(200);
      const approved = await approveRes.json();
      expect(approved.status).toBe("APPROVED");
    });
  });

  // ── Training Logs ─────────────────────────────────────────────

  test.describe("Training Logs", () => {
    test("GET /api/v1/training-logs returns 401 without auth", async ({ request }) => {
      const res = await apiGet(request, "/api/v1/training-logs?centerId=fake");
      expect(res.status()).toBe(401);
    });

    test("GET /api/v1/training-logs returns logs for admin", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const res = await apiGet(request, `/api/v1/training-logs?centerId=${centerId}`, cookies);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/v1/training-logs creates a training entry", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const today = new Date().toISOString().split("T")[0];
      const res = await apiPost(
        request,
        "/api/v1/training-logs",
        {
          centerId,
          userId: teacherUserId || undefined,
          topic: "E2E Test Training",
          hours: 2,
          date: today,
          category: "Safety",
          description: "Created by E2E test",
        },
        cookies,
      );
      expect([200, 201]).toContain(res.status());
    });

    test("GET /api/v1/training-logs/summary returns summary", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const qs = teacherUserId
        ? `centerId=${centerId}&userId=${teacherUserId}`
        : `centerId=${centerId}`;
      const res = await apiGet(request, `/api/v1/training-logs/summary?${qs}`, cookies);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("totalHours");
    });
  });

  // ── Evaluations ───────────────────────────────────────────────

  test.describe("Evaluations", () => {
    test("GET /api/v1/evaluations returns 401 without auth", async ({ request }) => {
      const res = await apiGet(request, "/api/v1/evaluations?centerId=fake");
      expect(res.status()).toBe(401);
    });

    test("GET /api/v1/evaluations returns evaluations for admin", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const res = await apiGet(request, `/api/v1/evaluations?centerId=${centerId}`, cookies);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/v1/evaluations creates an evaluation", async ({ request }) => {
      if (!centerId || !teacherUserId) test.skip();
      const cookies = await loginAsAdmin(request);
      const res = await apiPost(
        request,
        "/api/v1/evaluations",
        {
          centerId,
          teacherId: teacherUserId,
          period: "2026-02",
          categories: {
            "Classroom Management": 4,
            "Communication": 3,
            "Curriculum Delivery": 4,
            "Child Engagement": 5,
            "Professionalism": 4,
          },
          strengths: "E2E test strengths",
          areasForImprovement: "E2E test areas",
          goals: "E2E test goals",
          notes: "Created by E2E test",
        },
        cookies,
      );
      expect([200, 201]).toContain(res.status());
    });

    test("teacher cannot create evaluations", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsTeacher(request);
      const res = await apiPost(
        request,
        "/api/v1/evaluations",
        {
          centerId,
          teacherId: "some-id",
          period: "2026-02",
          categories: {},
        },
        cookies,
      );
      expect(res.status()).toBe(403);
    });

    test("teacher can view own evaluations", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsTeacher(request);
      const res = await apiGet(request, `/api/v1/evaluations?centerId=${centerId}`, cookies);
      expect(res.status()).toBe(200);
    });
  });
});
