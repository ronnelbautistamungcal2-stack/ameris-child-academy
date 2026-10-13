// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsCoach, loginAsHrStaff, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete, pickDemoCenterId } = require("../helpers/api");

// A local date N days ago at the given time, as an ISO string. Time sheets
// store days in the server's local time, so build local times here too.
function localTime(daysAgo, hours, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function localDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test.describe("Time sheets and audit @api", () => {
  test.describe.configure({ mode: "serial" });

  let centerId;
  let child;
  let staffer;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const centers = await (await apiGet(request, "/api/v1/centers", admin)).json();
    centerId = pickDemoCenterId(centers);

    child = await (
      await apiPost(request, "/api/v1/children", { firstName: "Timesheet", lastName: "Kid", centerId }, admin)
    ).json();
    staffer = await (
      await apiPost(
        request,
        "/api/v1/users",
        {
          email: `timesheet-staff-${Date.now()}@example.com`,
          name: "Tina Sheet",
          middleInitial: "M",
          password: "password123",
          roles: ["TEACHER"],
          centerId,
        },
        admin,
      )
    ).json();
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (child?.id) await apiDelete(request, `/api/v1/children/${child.id}`, admin);
    if (staffer?.id) await apiDelete(request, `/api/v1/users/${staffer.id}`, admin);
  });

  test("admins add, correct and delete child time sheet rows, and each change is audited", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const base = `/api/v1/time-sheets/child/${child.id}`;

    const created = await apiPost(request, base, { timeIn: localTime(2, 7, 55), timeOut: localTime(2, 16, 45) }, admin);
    expect(created.status()).toBe(201);
    const rowId = (await created.json()).id;

    expect((await apiPost(request, base, { timeIn: localTime(2, 9, 0) }, admin)).status()).toBe(409);
    expect((await apiPost(request, base, { timeIn: localTime(3, 9, 0), timeOut: localTime(3, 8, 0) }, admin)).status()).toBe(400);

    const sheet = await (await apiGet(request, base, admin)).json();
    expect(sheet.subject.name).toBe("Timesheet Kid");
    const row = sheet.rows.find((r) => r.id === rowId);
    expect(row.inBy).toBe("AU");
    expect(row.outBy).toBe("AU");

    // New rows are not audited; only changes and deletions are.
    expect((await (await apiGet(request, `${base}/audit`, admin)).json()).entries).toHaveLength(0);

    // Saving unchanged times records nothing.
    expect((await apiPut(request, `${base}/${rowId}`, { timeIn: row.timeIn, timeOut: row.timeOut }, admin)).status()).toBe(200);
    expect((await (await apiGet(request, `${base}/audit`, admin)).json()).entries).toHaveLength(0);

    const newOut = localTime(2, 16, 39);
    expect((await apiPut(request, `${base}/${rowId}`, { timeOut: newOut }, admin)).status()).toBe(200);
    expect((await apiDelete(request, `${base}/${rowId}`, admin)).status()).toBe(204);

    const audit = await (await apiGet(request, `${base}/audit`, admin)).json();
    expect(audit.entries.map((e) => e.action)).toEqual(["CHECK_OUT_CHANGED", "DELETED"]);
    const [change, deletion] = audit.entries;
    expect(new Date(change.originalOut).toISOString()).toBe(row.timeOut);
    expect(new Date(change.newValue).toISOString()).toBe(newOut);
    expect(change.changedByInitials).toBe("AU");
    // The deletion keeps the times as they were just before it was deleted.
    expect(new Date(deletion.originalOut).toISOString()).toBe(newOut);
    expect(deletion.originalOutBy).toBe("AU");

    expect((await (await apiGet(request, base, admin)).json()).rows).toHaveLength(0);
  });

  test("the report date range limits the rows", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const base = `/api/v1/time-sheets/child/${child.id}`;
    await apiPost(request, base, { timeIn: localTime(5, 8, 0), timeOut: localTime(5, 16, 0) }, admin);
    await apiPost(request, base, { timeIn: localTime(1, 8, 0), timeOut: localTime(1, 16, 0) }, admin);
    const ranged = await (await apiGet(request, `${base}?from=${localDate(2)}&to=${localDate(0)}`, admin)).json();
    expect(ranged.rows).toHaveLength(1);
    expect((await (await apiGet(request, base, admin)).json()).rows).toHaveLength(2);
  });

  test("only admins edit child time sheets; admin, coach and HR edit staff ones", async ({ request }) => {
    const teacher = await loginAsTeacher(request);
    expect((await apiGet(request, `/api/v1/time-sheets/child/${child.id}`, teacher)).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/time-sheets/staff/${staffer.id}`, teacher)).status()).toBe(403);

    const parent = await loginAsParent(request);
    expect((await apiGet(request, "/api/v1/time-sheets/staff", parent)).status()).toBe(403);

    const hr = await loginAsHrStaff(request);
    expect((await apiGet(request, `/api/v1/time-sheets/child/${child.id}`, hr)).status()).toBe(403);
    const list = await (await apiGet(request, "/api/v1/time-sheets/staff", hr)).json();
    expect(list.map((s) => s.id)).toContain(staffer.id);

    const base = `/api/v1/time-sheets/staff/${staffer.id}`;
    const created = await apiPost(request, base, { timeIn: localTime(1, 7, 0), timeOut: localTime(1, 15, 30) }, hr);
    expect(created.status()).toBe(201);
    const rowId = (await created.json()).id;

    const coach = await loginAsCoach(request);
    expect((await apiPut(request, `${base}/${rowId}`, { timeIn: localTime(1, 7, 5) }, coach)).status()).toBe(200);

    const audit = await (await apiGet(request, `${base}/audit`, hr)).json();
    expect(audit.subject.name).toBe("Tina Sheet");
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].action).toBe("CHECK_IN_CHANGED");
    expect(audit.entries[0].originalInBy).toBe("HU");
    expect(audit.entries[0].changedByInitials).toBe("CU");

    const rows = (await (await apiGet(request, base, hr)).json()).rows;
    expect(rows[0].inBy).toBe("CU");
    expect(rows[0].outBy).toBe("HU");
    expect(rows[0].label).toBe("Teacher");
  });
});
