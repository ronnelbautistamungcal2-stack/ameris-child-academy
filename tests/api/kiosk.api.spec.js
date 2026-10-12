// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost, apiDelete } = require("../helpers/api");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

// A 6-digit PIN nobody else is likely to hold; retried on PIN_TAKEN.
function randomPin() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

async function json(res) {
  return res.json().catch(() => ({}));
}

test.describe("Front-desk kiosk @api", () => {
  // The tests share one enrolled device and must run in order.
  test.describe.configure({ mode: "serial" });

  let centerId;
  let kiosk; // request context that holds the enrolled device cookie
  let deviceId;
  const cleanup = { users: [], children: [], pickups: [] };

  test.beforeAll(async ({ request, playwright }) => {
    const admin = await loginAsAdmin(request);
    const centers = await (await apiGet(request, "/api/v1/centers", admin)).json();
    centerId = (centers.find((c) => c.name === "Demo Center") || centers[0]).id;

    // Enroll a fresh browser context as this center's kiosk. The admin cookie
    // is only needed for the enrollment call itself.
    kiosk = await playwright.request.newContext({ baseURL: BASE_URL });
    const enroll = await kiosk.post("/api/v1/kiosk/devices", {
      headers: { Cookie: admin, "Content-Type": "application/json" },
      data: { centerId, name: "QA kiosk" },
    });
    expect(enroll.status()).toBe(201);
    deviceId = (await enroll.json()).id;
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    for (const id of cleanup.pickups) await apiDelete(request, `/api/v1/pickup-people/${id}`, admin);
    for (const id of cleanup.children) await apiDelete(request, `/api/v1/children/${id}`, admin);
    for (const id of cleanup.users) await apiDelete(request, `/api/v1/users/${id}`, admin);
    if (deviceId) await apiDelete(request, `/api/v1/kiosk/devices?id=${deviceId}`, admin);
    await kiosk?.dispose();
  });

  // Registers a PIN at the kiosk with a registration code, retrying taken PINs.
  async function registerPin(code) {
    const check = await kiosk.post("/api/v1/kiosk/register/check", { data: { code } });
    expect(check.status()).toBe(200);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const pin = randomPin();
      const done = await kiosk.post("/api/v1/kiosk/register/complete", { data: { code, pin } });
      if (done.status() === 200) return { pin, name: (await check.json()).name };
      expect(done.status()).toBe(409);
    }
    throw new Error("could not register a PIN");
  }

  test("only enrolled devices and admins can use the kiosk", async ({ request, playwright }) => {
    const stranger = await playwright.request.newContext({ baseURL: BASE_URL });
    expect((await (await stranger.get("/api/v1/kiosk/device")).json()).enrolled).toBe(false);
    expect((await stranger.post("/api/v1/kiosk/identify", { data: { pin: "123456" } })).status()).toBe(403);
    await stranger.dispose();

    const device = await (await kiosk.get("/api/v1/kiosk/device")).json();
    expect(device.enrolled).toBe(true);
    expect(device.center.id).toBe(centerId);

    const teacher = await loginAsTeacher(request);
    expect((await apiPost(request, "/api/v1/kiosk/devices", { centerId }, teacher)).status()).toBe(403);
  });

  test("a staff member registers a PIN and clocks in and out with their initials recorded", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const created = await apiPost(
      request,
      "/api/v1/users",
      {
        email: `kiosk-staff-${Date.now()}@example.com`,
        name: "Kiosk Staffer",
        middleInitial: "Q",
        password: "password123",
        roles: ["TEACHER"],
        centerId,
      },
      admin,
    );
    expect(created.status()).toBe(201);
    const user = await created.json();
    cleanup.users.push(user.id);

    const { code } = await json(await apiPost(request, `/api/v1/users/${user.id}/pin-reset`, {}, admin));
    const { pin, name } = await registerPin(code);
    expect(name).toBe("Kiosk Staffer");

    // The registration number works only once.
    expect((await kiosk.post("/api/v1/kiosk/register/check", { data: { code } })).status()).toBe(401);

    const who = await kiosk.post("/api/v1/kiosk/identify", { data: { pin } });
    expect(who.status()).toBe(200);
    const identity = await who.json();
    expect(identity.name).toBe("Kiosk Staffer");
    expect(identity.employee.clockedIn).toBe(false);
    expect(identity.parent).toBeNull();

    const clockIn = await kiosk.post("/api/v1/kiosk/clock", { data: { token: identity.token, action: "in" } });
    expect(clockIn.status()).toBe(200);
    expect((await clockIn.json()).status.clockedIn).toBe(true);
    expect((await kiosk.post("/api/v1/kiosk/clock", { data: { token: identity.token, action: "in" } })).status()).toBe(409);

    const clockOut = await kiosk.post("/api/v1/kiosk/clock", { data: { token: identity.token, action: "out" } });
    expect((await clockOut.json()).status.clockedIn).toBe(false);

    // The By columns carry the staff member's initials.
    // Days are stored in the server's local time, so ask for a range around today.
    const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const rows = await (
      await apiGet(request, `/api/v1/staff-attendance?centerId=${centerId}&from=${day(-1)}&to=${day(1)}`, admin)
    ).json();
    const row = (Array.isArray(rows) ? rows : rows.records || []).find((r) => r.userId === user.id);
    expect(row.clockInBy).toBe("KQS");
    expect(row.clockOutBy).toBe("KQS");

    // A tampered or foreign pass is refused.
    expect((await kiosk.post("/api/v1/kiosk/clock", { data: { token: `${identity.token}x`, action: "in" } })).status()).toBe(401);
  });

  test("an authorized pickup person signs a child in and out", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const childRes = await apiPost(request, "/api/v1/children", { firstName: "Kiosk", lastName: "Kid", centerId }, admin);
    expect(childRes.status()).toBe(201);
    const child = await childRes.json();
    cleanup.children.push(child.id);

    const list = await json(
      await apiPost(
        request,
        `/api/v1/children/${child.id}/pickup-people`,
        { firstName: "Nana", middleInitial: "B", lastName: `Pickup${Date.now()}` },
        admin,
      ),
    );
    const person = list[0];
    cleanup.pickups.push(person.id);

    const { code } = await json(await apiPost(request, `/api/v1/pickup-people/${person.id}/pin-reset`, {}, admin));
    const { pin } = await registerPin(code);

    const identity = await json(await kiosk.post("/api/v1/kiosk/identify", { data: { pin } }));
    expect(identity.employee).toBeNull();
    expect(identity.parent.children.map((c) => c.id)).toEqual([child.id]);

    const signIn = await kiosk.post("/api/v1/kiosk/children", {
      data: { token: identity.token, childIds: [child.id], action: "in" },
    });
    expect(signIn.status()).toBe(200);
    expect((await signIn.json()).children[0].signedIn).toBe(true);

    // Children the person is not authorized for are refused.
    const other = await kiosk.post("/api/v1/kiosk/children", {
      data: { token: identity.token, childIds: ["not-their-child"], action: "in" },
    });
    expect(other.status()).toBe(403);

    const signOut = await kiosk.post("/api/v1/kiosk/children", {
      data: { token: identity.token, childIds: [child.id], action: "out" },
    });
    expect((await signOut.json()).children[0].signedIn).toBe(false);
  });

  test("wrong PINs lock the device after five tries", async () => {
    // Runs last: it locks this test device, which afterAll then revokes.
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await kiosk.post("/api/v1/kiosk/register/check", { data: { code: "000000" } });
      statuses.push(res.status());
    }
    expect(statuses.slice(0, 5).every((s) => s === 401 || s === 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
