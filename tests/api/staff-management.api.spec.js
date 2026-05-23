// @ts-check
const { test, expect } = require("@playwright/test");
const XLSX = require("xlsx");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");

test.describe("Staff Management API @api", () => {
  let centerId;
  let teacherUserId;
  let teacherUserName;
  let teacherUserEmail;

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
        teacherUserName = Array.isArray(users) && users.length > 0 ? users[0].name : null;
        teacherUserEmail = Array.isArray(users) && users.length > 0 ? users[0].email : null;
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

    test("POST /api/v1/staff-attendance/import imports a workbook", async ({ request }) => {
      if (!centerId || (!teacherUserEmail && !teacherUserName)) test.skip();
      const cookies = await loginAsAdmin(request);
      const today = new Date().toISOString().split("T")[0];

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet([
        {
          "Employee Email": teacherUserEmail || "",
          "Employee Name": teacherUserName || "",
          Date: today,
          "Clock In": "08:15",
          "Clock Out": "17:05",
          Status: "PRESENT",
          "Late Minutes": 0,
          Notes: "Imported by API test",
        },
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, "Timesheet");

      const fileBase64 = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }).toString("base64");

      const res = await apiPost(
        request,
        "/api/v1/staff-attendance/import",
        {
          centerId,
          fileBase64,
          overwriteExisting: true,
        },
        cookies,
      );
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.importedCount).toBeGreaterThan(0);
      expect(data.errorCount).toBe(0);
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

    test("POST /api/v1/time-off warns when request exceeds available hours and allows override", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsTeacher(request);

      const warnRes = await apiPost(
        request,
        "/api/v1/time-off",
        {
          centerId,
          type: "UNPAID",
          startDate: "2026-03-20T08:00:00.000Z",
          endDate: "2026-03-20T12:00:00.000Z",
          reason: "Overage warning test",
        },
        cookies,
      );
      expect(warnRes.status()).toBe(409);
      const warnBody = await warnRes.json();
      expect(warnBody.code).toBe("TIME_OFF_BALANCE_WARNING");
      expect(warnBody.canProceed).toBe(true);

      const proceedRes = await apiPost(
        request,
        "/api/v1/time-off",
        {
          centerId,
          type: "UNPAID",
          startDate: "2026-03-20T08:00:00.000Z",
          endDate: "2026-03-20T12:00:00.000Z",
          reason: "Overage warning override test",
          overrideBalanceWarning: true,
        },
        cookies,
      );
      expect([200, 201]).toContain(proceedRes.status());
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
        {
          status: "APPROVED",
          coverageName: "QA Coverage Staff",
          reviewNotes: "Approved during API coverage test",
        },
        adminCookies,
      );
      expect(approveRes.status()).toBe(200);
      const approved = await approveRes.json();
      expect(approved.status).toBe("APPROVED");
      expect(approved.coverageName).toBe("QA Coverage Staff");
    });

    test("approved paid requests reduce paid hours available", async ({ request }) => {
      if (!centerId || !teacherUserId) test.skip();

      const adminCookies = await loginAsAdmin(request);
      const teacherCookies = await loginAsTeacher(request);

      const earnedDate = "2026-04-01";
      const addBalanceRes = await apiPost(
        request,
        "/api/v1/time-off/balances",
        {
          centerId,
          userId: teacherUserId,
          earnedDate,
          paidHours: 12,
          unpaidHours: 0,
          note: "API balance test",
        },
        adminCookies,
      );
      expect(addBalanceRes.status()).toBe(201);

      const beforeRes = await apiGet(
        request,
        `/api/v1/time-off/balances?centerId=${centerId}&userId=${teacherUserId}`,
        adminCookies,
      );
      expect(beforeRes.status()).toBe(200);
      const before = await beforeRes.json();

      const createRes = await apiPost(
        request,
        "/api/v1/time-off",
        {
          centerId,
          type: "PAID",
          startDate: "2026-04-10T08:00:00.000Z",
          endDate: "2026-04-10T12:00:00.000Z",
          reason: "Balance usage test",
        },
        teacherCookies,
      );
      expect([200, 201]).toContain(createRes.status());
      const created = await createRes.json();

      const approveRes = await apiPut(
        request,
        `/api/v1/time-off/${created.id}`,
        {
          status: "APPROVED",
          reviewNotes: "Approved for balance usage test",
        },
        adminCookies,
      );
      expect(approveRes.status()).toBe(200);

      const afterRes = await apiGet(
        request,
        `/api/v1/time-off/balances?centerId=${centerId}&userId=${teacherUserId}`,
        adminCookies,
      );
      expect(afterRes.status()).toBe(200);
      const after = await afterRes.json();

      expect(after.summary.paidAvailable).toBeCloseTo(
        before.summary.paidAvailable - 4,
        5,
      );
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

  test.describe("Teacher Training Pathways", () => {
    test("GET /api/v1/teacher-training-pathways returns pathways for admin", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const res = await apiGet(
        request,
        `/api/v1/teacher-training-pathways?centerId=${centerId}&includeInactive=1`,
        cookies,
      );
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/v1/teacher-training-pathways creates a pathway", async ({ request }) => {
      if (!centerId) test.skip();
      const cookies = await loginAsAdmin(request);
      const res = await apiPost(
        request,
        "/api/v1/teacher-training-pathways",
        {
          centerId,
          title: "API Test Teacher Pathway",
          description: "Created by API coverage",
          effectiveDate: "2026-05-01",
          active: true,
          topics: [
            {
              title: "Orientation basics",
              description: "Review onboarding expectations",
              durationHours: 1,
              required: true,
            },
            {
              title: "Safety walkthrough",
              durationHours: 1.5,
              required: false,
            },
          ],
        },
        cookies,
      );
      expect([200, 201]).toContain(res.status());
      const data = await res.json();
      expect(data.title).toBe("API Test Teacher Pathway");
      expect(Array.isArray(data.topics)).toBe(true);
      expect(data.topics.length).toBe(2);
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
          periodStart: "2026-02-01",
          periodEnd: "2026-02-14",
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
      const data = await res.json();
      expect(data.periodStart).toBeTruthy();
      expect(data.periodEnd).toBeTruthy();
      expect(data.period).toContain("2026-02-01");
      expect(data.period).toContain("2026-02-14");
    });

    test("POST /api/v1/evaluations rejects an invalid period range", async ({ request }) => {
      if (!centerId || !teacherUserId) test.skip();
      const cookies = await loginAsAdmin(request);
      const res = await apiPost(
        request,
        "/api/v1/evaluations",
        {
          centerId,
          teacherId: teacherUserId,
          periodStart: "2026-02-14",
          periodEnd: "2026-02-01",
          categories: {},
        },
        cookies,
      );
      expect(res.status()).toBe(400);
    });

    test("GET /api/v1/evaluations filters by employee, status, and period date range", async ({ request }) => {
      if (!centerId || !teacherUserId) test.skip();
      const cookies = await loginAsAdmin(request);
      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const currentMonthEnd = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth.getDate()).padStart(2, "0")}`;

      const createRes = await apiPost(
        request,
        "/api/v1/evaluations",
        {
          centerId,
          teacherId: teacherUserId,
          periodStart: "2031-07-01",
          periodEnd: "2031-07-14",
          categories: {
            "Classroom Management": 4,
            "Communication": 4,
            "Curriculum Delivery": 4,
            "Child Engagement": 5,
            "Professionalism": 4,
          },
          notes: "API filter coverage",
        },
        cookies,
      );
      expect([200, 201]).toContain(createRes.status());
      const created = await createRes.json();

      const submitRes = await apiPut(
        request,
        `/api/v1/evaluations/${created.id}`,
        { status: "SUBMITTED" },
        cookies,
      );
      expect(submitRes.status()).toBe(200);

      const filteredRes = await apiGet(
        request,
        `/api/v1/evaluations?centerId=${centerId}&teacherId=${teacherUserId}&status=SUBMITTED&from=2031-07-01&to=2031-07-14`,
        cookies,
      );
      expect(filteredRes.status()).toBe(200);
      const filtered = await filteredRes.json();
      expect(filtered.some((evaluation) => evaluation.id === created.id)).toBe(true);

      const currentMonthRes = await apiGet(
        request,
        `/api/v1/evaluations?centerId=${centerId}&teacherId=${teacherUserId}&from=${currentMonthStart}&to=${currentMonthEnd}`,
        cookies,
      );
      expect(currentMonthRes.status()).toBe(200);
      const currentMonth = await currentMonthRes.json();
      expect(currentMonth.some((evaluation) => evaluation.id === created.id)).toBe(false);
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
