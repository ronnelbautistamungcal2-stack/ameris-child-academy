// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent, loginAsHrStaff } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete, pickDemoCenterId } = require("../helpers/api");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

// Signs in from a fresh, cookie-free context and returns who the session belongs
// to (null when sign-in was refused). The shared helpers cache cookies, which
// would hide a refused login.
async function freshSignIn(playwright, email, password) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  try {
    const { csrfToken } = await (await ctx.get("/api/auth/csrf")).json();
    await ctx.post("/api/auth/callback/credentials?json=true", {
      form: { csrfToken, email, password },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const session = await (await ctx.get("/api/auth/session")).json();
    return session?.user?.email || null;
  } finally {
    await ctx.dispose();
  }
}

test.describe("Kiosk PINs, disabled users and authorized pickups @api", () => {
  let centerId;
  const createdUserIds = [];
  const createdPickupIds = [];

  test.beforeAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const centers = await (await apiGet(request, "/api/v1/centers", cookies)).json();
    centerId = pickDemoCenterId(centers);
  });

  test.afterAll(async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    for (const id of createdPickupIds) await apiDelete(request, `/api/v1/pickup-people/${id}`, cookies);
    for (const id of createdUserIds) await apiDelete(request, `/api/v1/users/${id}`, cookies);
  });

  test("new users need a middle initial, and a disabled user cannot sign in", async ({ request, playwright }) => {
    const cookies = await loginAsAdmin(request);
    const email = `pin-user-${Date.now()}@example.com`;
    const base = { email, name: "Pat Example", password: "password123", roles: ["PARENT"] };

    const missing = await apiPost(request, "/api/v1/users", base, cookies);
    expect(missing.status()).toBe(400);

    const created = await apiPost(request, "/api/v1/users", { ...base, middleInitial: "q." }, cookies);
    expect(created.status()).toBe(201);
    const user = await created.json();
    createdUserIds.push(user.id);
    expect(user.middleInitial).toBe("Q");
    expect(user.disabled).toBe(false);
    expect(user.pinStatus).toEqual({ hasPin: false, pinSetAt: null, registrationPending: false, registrationExpiresAt: null });
    expect(user).not.toHaveProperty("kioskCredential");

    expect(await freshSignIn(playwright, email, "password123")).toBe(email);

    const disable = await apiPut(request, `/api/v1/users/${user.id}`, { disabled: true }, cookies);
    expect(disable.status()).toBe(200);
    expect(await freshSignIn(playwright, email, "password123")).toBeNull();

    await apiPut(request, `/api/v1/users/${user.id}`, { disabled: false }, cookies);
    expect(await freshSignIn(playwright, email, "password123")).toBe(email);

    const session = await (await apiGet(request, "/api/auth/session", cookies)).json();
    const selfDisable = await apiPut(request, `/api/v1/users/${session.user.id}`, { disabled: true }, cookies);
    expect(selfDisable.status()).toBe(400);
  });

  test("PIN resets issue a one-time 6-digit code; HR may reset staff but not parents", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const users = await (await apiGet(request, "/api/v1/users", admin)).json();
    const teacher = users.find((u) => u.email === "teacher@demo.com");
    const parent = users.find((u) => u.email === "parent@demo.com");

    const reset = await apiPost(request, `/api/v1/users/${teacher.id}/pin-reset`, {}, admin);
    expect(reset.status()).toBe(200);
    const { code, expiresAt } = await reset.json();
    expect(code).toMatch(/^\d{6}$/);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    const after = (await (await apiGet(request, "/api/v1/users", admin)).json()).find((u) => u.id === teacher.id);
    expect(after.pinStatus.registrationPending).toBe(true);
    expect(after.pinStatus.hasPin).toBe(false);

    const hr = await loginAsHrStaff(request);
    expect((await apiPost(request, `/api/v1/users/${teacher.id}/pin-reset`, {}, hr)).status()).toBe(200);
    expect((await apiPost(request, `/api/v1/users/${parent.id}/pin-reset`, {}, hr)).status()).toBe(403);

    const teacherCookies = await loginAsTeacher(request);
    expect((await apiPost(request, `/api/v1/users/${teacher.id}/pin-reset`, {}, teacherCookies)).status()).toBe(403);
  });

  test("View PIN requires the user's own password", async ({ request }) => {
    const cookies = await loginAsAdmin(request);
    const session = await (await apiGet(request, "/api/auth/session", cookies)).json();
    const url = `/api/v1/users/${session.user.id}/pin`;

    expect((await apiPost(request, url, { password: "wrong-password" }, cookies)).status()).toBe(400);
    const ok = await apiPost(request, url, { password: "adminpass" }, cookies);
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(typeof body.hasPin).toBe("boolean");

    const users = await (await apiGet(request, "/api/v1/users", cookies)).json();
    const teacher = users.find((u) => u.email === "teacher@demo.com");
    expect((await apiPost(request, `/api/v1/users/${teacher.id}/pin`, { password: "adminpass" }, cookies)).status()).toBe(403);
  });

  test("admins manage a child's authorized pickups; teachers and parents can only view", async ({ request }) => {
    if (!centerId) test.skip();
    const admin = await loginAsAdmin(request);
    const kidsRes = await (await apiGet(request, `/api/v1/children?centerId=${centerId}`, admin)).json();
    const kids = Array.isArray(kidsRes) ? kidsRes : kidsRes.children || [];
    expect(kids.length).toBeGreaterThan(1);
    const [child, sibling] = kids;
    const url = `/api/v1/children/${child.id}/pickup-people`;
    const suffix = Date.now();

    expect((await apiPost(request, url, { firstName: "Gran", lastName: `Tester${suffix}` }, admin)).status()).toBe(400);
    const added = await apiPost(
      request,
      url,
      { firstName: "Gran", middleInitial: "m", lastName: `Tester${suffix}`, phone: "555-0100" },
      admin,
    );
    expect(added.status()).toBe(201);
    const person = (await added.json()).find((p) => p.lastName === `Tester${suffix}`);
    createdPickupIds.push(person.id);
    expect(person.middleInitial).toBe("M");
    expect(person.pinStatus.hasPin).toBe(false);
    expect(person).not.toHaveProperty("kioskCredential");

    const reset = await apiPost(request, `/api/v1/pickup-people/${person.id}/pin-reset`, {}, admin);
    expect(reset.status()).toBe(200);
    expect((await reset.json()).code).toMatch(/^\d{6}$/);
    const listed = (await (await apiGet(request, url, admin)).json()).find((p) => p.id === person.id);
    expect(listed.pinStatus.registrationPending).toBe(true);

    const renamed = await apiPut(request, `/api/v1/pickup-people/${person.id}`, { firstName: "Granny" }, admin);
    expect((await renamed.json()).firstName).toBe("Granny");

    const found = await (await apiGet(request, `/api/v1/pickup-people?centerId=${centerId}&q=Tester${suffix}`, admin)).json();
    expect(found.map((p) => p.id)).toContain(person.id);

    const copied = await apiPost(request, `/api/v1/children/${sibling.id}/pickup-people`, { copyFromChildId: child.id }, admin);
    expect((await copied.json()).map((p) => p.id)).toContain(person.id);

    const teacher = await loginAsTeacher(request);
    expect((await apiGet(request, url, teacher)).status()).toBe(200);
    expect((await apiPost(request, url, { pickupPersonId: person.id }, teacher)).status()).toBe(403);

    const parent = await loginAsParent(request);
    const parentKidsRes = await (await apiGet(request, `/api/v1/children?centerId=${centerId}`, parent)).json();
    const parentKids = Array.isArray(parentKidsRes) ? parentKidsRes : parentKidsRes.children || [];
    if (parentKids.length) {
      const ownUrl = `/api/v1/children/${parentKids[0].id}/pickup-people`;
      expect((await apiGet(request, ownUrl, parent)).status()).toBe(200);
      expect((await apiDelete(request, `${ownUrl}?pickupPersonId=${person.id}`, parent)).status()).toBe(403);
    }
    const notOwn = kids.find((k) => !parentKids.some((p) => p.id === k.id));
    if (notOwn) {
      expect((await apiGet(request, `/api/v1/children/${notOwn.id}/pickup-people`, parent)).status()).toBe(403);
    }

    const removed = await apiDelete(request, `/api/v1/children/${sibling.id}/pickup-people?pickupPersonId=${person.id}`, admin);
    expect((await removed.json()).map((p) => p.id)).not.toContain(person.id);
  });
});
