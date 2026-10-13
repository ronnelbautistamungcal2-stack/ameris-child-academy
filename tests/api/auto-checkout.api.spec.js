// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

// Local time N days ago, as ISO; attendance days are stored in local time.
function localTime(daysAgo, hours, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

test.describe("Automatic child checkout @api", () => {
  test.describe.configure({ mode: "serial" });

  let center;
  let child;
  let staffer;

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (staffer?.id) await apiDelete(request, `/api/v1/users/${staffer.id}`, admin);
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, admin);
  });

  test("the checkout time must be HH:MM", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const bad = await apiPost(request, "/api/v1/centers", { name: "QA Bad Checkout", autoCheckoutTime: "25:00" }, admin);
    expect(bad.status()).toBe(400);
  });

  test("children still signed in are signed out at the center's time, as Admin; staff are not", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const created = await apiPost(
      request,
      "/api/v1/centers",
      { name: `QA Auto Checkout ${Date.now()}`, autoCheckoutTime: "16:00" },
      admin,
    );
    expect(created.status()).toBe(201);
    center = await created.json();
    expect(center.autoCheckoutTime).toBe("16:00");

    child = await (await apiPost(request, "/api/v1/children", { firstName: "Auto", lastName: "Checkout", centerId: center.id }, admin)).json();
    staffer = await (
      await apiPost(
        request,
        "/api/v1/users",
        {
          email: `auto-checkout-${Date.now()}@example.com`,
          name: "Stay Clocked",
          middleInitial: "N",
          password: "password123",
          roles: ["TEACHER"],
          centerId: center.id,
        },
        admin,
      )
    ).json();

    const childSheet = `/api/v1/time-sheets/child/${child.id}`;
    const staffSheet = `/api/v1/time-sheets/staff/${staffer.id}`;
    // Forgot to sign out two days ago; signed in after the checkout time yesterday.
    expect((await apiPost(request, childSheet, { timeIn: localTime(2, 8, 0) }, admin)).status()).toBe(201);
    expect((await apiPost(request, childSheet, { timeIn: localTime(1, 17, 30) }, admin)).status()).toBe(201);
    expect((await apiPost(request, staffSheet, { timeIn: localTime(2, 7, 0) }, admin)).status()).toBe(201);

    const run = await apiPost(request, "/api/v1/jobs/run", { job: "auto-checkout" }, admin);
    expect(run.status()).toBe(200);

    const rows = (await (await apiGet(request, childSheet, admin)).json()).rows;
    const twoDaysAgo = rows.find((r) => new Date(r.timeIn).toISOString() === localTime(2, 8, 0));
    expect(new Date(twoDaysAgo.timeOut).toISOString()).toBe(localTime(2, 16, 0));
    expect(twoDaysAgo.outBy).toBe("Admin");

    const lateArrival = rows.find((r) => new Date(r.timeIn).toISOString() === localTime(1, 17, 30));
    expect(lateArrival.timeOut).toBeNull();

    const staffRows = (await (await apiGet(request, staffSheet, admin)).json()).rows;
    expect(staffRows[0].timeOut).toBeNull();
  });

  test("clearing the time turns automatic checkout off", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const cleared = await apiPut(request, `/api/v1/centers/${center.id}`, { name: center.name, autoCheckoutTime: "" }, admin);
    expect(cleared.status()).toBe(200);
    expect((await cleared.json()).autoCheckoutTime).toBeNull();
  });
});
