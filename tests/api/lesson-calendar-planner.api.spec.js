// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

// A throwaway center so closed days (center-wide) never touch real calendars.
// 2099-06-01 is a Monday.
test.describe("Lesson Calendar and Lesson Planner @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;
  let classRoomId;
  let lessonId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const center = await apiPost(request, "/api/v1/centers", { name: `QA Curriculum ${Date.now()}` }, admin);
    centerId = (await center.json()).id;
    const room = await apiPost(request, "/api/v1/classes", { centerId, name: "QA Toddlers" }, admin);
    expect(room.status(), await room.text()).toBeLessThan(300);
    classRoomId = (await room.json()).id;
    const lesson = await apiPost(request, "/api/v1/lessons", { centerId, title: "QA Leaf Collage" }, admin);
    expect(lesson.status(), await lesson.text()).toBeLessThan(300);
    lessonId = (await lesson.json()).id;
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (centerId) await apiDelete(request, `/api/v1/centers/${centerId}`, admin);
  });

  const calendarUrl = (from, to) => `/api/v1/lesson-calendar?centerId=${centerId}&classRoomId=${classRoomId}&from=${from}&to=${to}`;

  test("a start day numbers school days and skips closed days", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const put = await apiPut(
      request,
      "/api/v1/lesson-calendar",
      { centerId, classRoomId, startDate: "2099-06-01", dayNumber: 1, closedDays: ["2099-06-03"] },
      admin,
    );
    expect(put.status(), await put.text()).toBe(200);

    const { days, closedDays, anchors } = await (await apiGet(request, calendarUrl("2099-06-01", "2099-06-12"), admin)).json();
    expect(anchors).toEqual([{ startDate: "2099-06-01", dayNumber: 1 }]);
    expect(closedDays).toEqual(["2099-06-03"]);
    expect(days["2099-06-01"]).toEqual({ day: 1, closed: false });
    expect(days["2099-06-02"].day).toBe(2);
    expect(days["2099-06-03"]).toEqual({ day: null, closed: true });
    expect(days["2099-06-04"].day).toBe(3);
    expect(days["2099-06-06"].day).toBeNull(); // Saturday
    expect(days["2099-06-08"].day).toBe(5);
  });

  test("a later start day restarts the count without touching earlier days", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    await apiPut(
      request,
      "/api/v1/lesson-calendar",
      { centerId, classRoomId, startDate: "2099-06-08", dayNumber: 20, closedDays: ["2099-06-03"] },
      admin,
    );
    const { days } = await (await apiGet(request, calendarUrl("2099-06-01", "2099-06-12"), admin)).json();
    expect(days["2099-06-05"].day).toBe(4);
    expect(days["2099-06-08"].day).toBe(20);
    expect(days["2099-06-12"].day).toBe(24);
  });

  test("calendar changes are checked", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const base = { centerId, classRoomId, dayNumber: 1, closedDays: [] };
    expect((await apiPut(request, "/api/v1/lesson-calendar", { ...base, startDate: "2020-01-06" }, admin)).status()).toBe(400);
    expect((await apiPut(request, "/api/v1/lesson-calendar", { ...base, startDate: "2099-06-06" }, admin)).status()).toBe(400);
    expect((await apiPut(request, "/api/v1/lesson-calendar", { ...base, startDate: "2099-06-08", dayNumber: 0 }, admin)).status()).toBe(400);
    expect((await apiPut(request, "/api/v1/lesson-calendar", { ...base, closedDays: ["2020-01-06"] }, admin)).status()).toBe(400);

    const teacher = await loginAsTeacher(request);
    expect((await apiPut(request, "/api/v1/lesson-calendar", { ...base, startDate: "2099-06-08" }, teacher)).status()).toBe(403);
    const parent = await loginAsParent(request);
    expect((await apiGet(request, calendarUrl("2099-06-01", "2099-06-05"), parent)).status()).toBe(403);
  });

  test("the planner places, moves and removes lessons by day", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const put = (body) => apiPut(request, "/api/v1/lesson-planner", { centerId, classRoomId, ...body }, admin);

    let res = await put({ action: "setCell", day: 1, rowIndex: 0, lessonId });
    expect(res.status(), await res.text()).toBe(200);
    res = await put({ action: "setCell", day: 2, rowIndex: 1, title: "Nature Walk" });
    let plan = await res.json();
    expect(plan.cells).toEqual([
      { day: 1, rowIndex: 0, lessonId, title: "QA Leaf Collage" },
      { day: 2, rowIndex: 1, lessonId: null, title: "Nature Walk" },
    ]);

    // Moving onto a taken cell swaps the two lessons.
    plan = await (await put({ action: "moveCell", from: { day: 1, rowIndex: 0 }, to: { day: 2, rowIndex: 1 } })).json();
    expect(plan.cells.map((c) => [c.day, c.rowIndex, c.title])).toEqual([
      [1, 0, "Nature Walk"],
      [2, 1, "QA Leaf Collage"],
    ]);

    plan = await (await put({ action: "setTheme", theme: "  Fall  " })).json();
    expect(plan.theme).toBe("Fall");
    plan = await (await put({ action: "addDay" })).json();
    expect(plan.dayCount).toBe(11);

    // Deleting Day 1 moves every later day back one.
    plan = await (await put({ action: "deleteDay", day: 1 })).json();
    expect(plan.dayCount).toBe(10);
    expect(plan.cells.map((c) => [c.day, c.rowIndex, c.title])).toEqual([[1, 1, "QA Leaf Collage"]]);

    // The bank lesson is checked as used because it sits in the planner.
    expect(plan.usedLessonIds).toEqual([lessonId]);
    plan = await (await put({ action: "setCell", day: 1, rowIndex: 1, title: "" })).json();
    expect(plan.usedLessonIds).toEqual([]);
    plan = await (await put({ action: "setCell", day: 1, rowIndex: 1, lessonId })).json();

    expect((await put({ action: "setCell", day: 99, rowIndex: 0, title: "x" })).status()).toBe(400);
    const teacher = await loginAsTeacher(request);
    const denied = await apiPut(request, "/api/v1/lesson-planner", { centerId, classRoomId, action: "addDay" }, teacher);
    expect(denied.status()).toBe(403);
  });

  test("the teacher week shows each date's day number and its lessons", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    // Day 21 (June 9) gets a lesson; June 8 is Day 20 from the earlier test.
    await apiPut(request, "/api/v1/lesson-planner", { centerId, classRoomId, action: "setCell", day: 10, rowIndex: 2, title: "Leaf Rubbing" }, admin);
    await apiPut(request, "/api/v1/lesson-calendar", { centerId, classRoomId, startDate: "2099-06-08", dayNumber: 9, closedDays: ["2099-06-10"] }, admin);

    const week = await (
      await apiGet(request, `/api/v1/lesson-planner/week?centerId=${centerId}&classRoomId=${classRoomId}&start=2099-06-08`, admin)
    ).json();
    expect(week.planned).toBe(true);
    expect(week.theme).toBe("Fall");
    expect(week.rows[0]).toEqual({ rowIndex: 0, label: "Hymn" });
    expect(week.days.map((d) => (d.closed ? "X" : d.day))).toEqual([9, 10, "X", 11, 12]);
    expect(week.days[1].cells).toEqual({ 2: { title: "Leaf Rubbing", lessonId: null } });
    expect(week.days[0].cells).toEqual({});
  });
});
