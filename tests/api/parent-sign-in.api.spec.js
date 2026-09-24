// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// A center pinned in downtown Atlanta. "Near" is ~0.2 miles away, "far" ~3 miles.
const CENTER = { latitude: 33.749, longitude: -84.388 };
const NEAR = { latitude: 33.752, longitude: -84.387 };
const FAR = { latitude: 33.79, longitude: -84.388 };
const PIN = "482915";

test.describe.serial("Parent sign-in/out API @api", () => {
  let parentId;
  let centerId;
  let unpinnedCenterId;
  let childId;
  let unpinnedChildId;

  test.beforeAll(async () => {
    const parent = await prisma.user.findUnique({ where: { email: "parent@demo.com" } });
    parentId = parent.id;
    await prisma.user.update({ where: { id: parentId }, data: { signInPinHash: null } });

    const center = await prisma.center.create({ data: { name: "E2E Sign-In Center" } });
    centerId = center.id;
    const unpinned = await prisma.center.create({ data: { name: "E2E Unpinned Center" } });
    unpinnedCenterId = unpinned.id;

    const child = await prisma.child.create({
      data: { firstName: "E2E Signin", lastName: "Kid", centerId, parentId },
    });
    childId = child.id;
    const other = await prisma.child.create({
      data: { firstName: "E2E Unpinned", lastName: "Kid", centerId: unpinnedCenterId, parentId },
    });
    unpinnedChildId = other.id;
  });

  test.afterAll(async () => {
    const childIds = [childId, unpinnedChildId].filter(Boolean);
    await prisma.attendance.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
    await prisma.center.deleteMany({ where: { id: { in: [centerId, unpinnedCenterId].filter(Boolean) } } });
    await prisma.user.update({ where: { id: parentId }, data: { signInPinHash: null } });
    await prisma.$disconnect();
  });

  test("requires a signed-in parent", async ({ request }) => {
    expect((await apiGet(request, "/api/v1/parent-sign-in")).status()).toBe(401);
    const admin = await loginAsAdmin(request);
    expect((await apiGet(request, "/api/v1/parent-sign-in", admin)).status()).toBe(403);
  });

  test("reports no PIN yet", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiGet(request, "/api/v1/parent-sign-in", cookies);
    expect(res.status()).toBe(200);
    expect((await res.json()).hasPin).toBe(false);
  });

  test("location check fails while no center is pinned", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPost(request, "/api/v1/parent-sign-in/location", NEAR, cookies);
    const data = await res.json();
    expect(data.withinRange).toBe(false);
  });

  test("admin pins the center with a one mile radius", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const bad = await apiPut(
      request,
      `/api/v1/centers/${centerId}`,
      { name: "E2E Sign-In Center", latitude: "abc", longitude: "-84" },
      admin,
    );
    expect(bad.status()).toBe(400);

    const res = await apiPut(
      request,
      `/api/v1/centers/${centerId}`,
      { name: "E2E Sign-In Center", ...CENTER, signInRadiusMeters: 1609 },
      admin,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.latitude).toBeCloseTo(CENTER.latitude);
    expect(data.signInRadiusMeters).toBe(1609);
  });

  test("location check: far away is rejected with the distance, nearby passes", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const far = await (await apiPost(request, "/api/v1/parent-sign-in/location", FAR, cookies)).json();
    expect(far.withinRange).toBe(false);
    expect(far.code).toBe("TOO_FAR");
    expect(far.distanceMeters).toBeGreaterThan(4000);
    expect(far.radiusMeters).toBe(1609);

    const near = await (await apiPost(request, "/api/v1/parent-sign-in/location", NEAR, cookies)).json();
    expect(near.withinRange).toBe(true);
  });

  test("creates a PIN only when both entries match", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const mismatch = await apiPost(
      request,
      "/api/v1/parent-sign-in/pin",
      { pin: PIN, confirmPin: "000000" },
      cookies,
    );
    expect(mismatch.status()).toBe(400);

    const short = await apiPost(request, "/api/v1/parent-sign-in/pin", { pin: "123", confirmPin: "123" }, cookies);
    expect(short.status()).toBe(400);

    const res = await apiPost(request, "/api/v1/parent-sign-in/pin", { pin: PIN, confirmPin: PIN }, cookies);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const kid = data.children.find((c) => c.id === childId);
    expect(kid.status).toBe("NOT_SIGNED_IN");

    const again = await apiPost(request, "/api/v1/parent-sign-in/pin", { pin: PIN, confirmPin: PIN }, cookies);
    expect(again.status()).toBe(409);
  });

  test("rejects a wrong PIN and accepts the right one", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const wrong = await apiPost(request, "/api/v1/parent-sign-in/pin", { pin: "111111" }, cookies);
    expect(wrong.status()).toBe(401);
    const right = await apiPost(request, "/api/v1/parent-sign-in/pin", { pin: PIN }, cookies);
    expect(right.status()).toBe(200);
  });

  test("signing in from too far away is refused", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPost(
      request,
      "/api/v1/parent-sign-in",
      { pin: PIN, ...FAR, changes: [{ childId, action: "IN" }] },
      cookies,
    );
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("TOO_FAR");
    expect(await prisma.attendance.count({ where: { childId } })).toBe(0);
  });

  test("a child whose center has no location cannot be signed in remotely", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPost(
      request,
      "/api/v1/parent-sign-in",
      { pin: PIN, ...NEAR, changes: [{ childId: unpinnedChildId, action: "IN" }] },
      cookies,
    );
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("CENTER_NOT_CONFIGURED");
  });

  test("a wrong PIN cannot sign a child in", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const res = await apiPost(
      request,
      "/api/v1/parent-sign-in",
      { pin: "999999", ...NEAR, changes: [{ childId, action: "IN" }] },
      cookies,
    );
    expect(res.status()).toBe(401);
  });

  test("signs in and out nearby, recording who did it", async ({ request }) => {
    const cookies = await loginAsParent(request);

    const outFirst = await apiPost(
      request,
      "/api/v1/parent-sign-in",
      { pin: PIN, ...NEAR, changes: [{ childId, action: "OUT" }] },
      cookies,
    );
    expect(outFirst.status()).toBe(409);

    const signIn = await apiPost(
      request,
      "/api/v1/parent-sign-in",
      { pin: PIN, ...NEAR, changes: [{ childId, action: "IN" }] },
      cookies,
    );
    expect(signIn.status()).toBe(200);
    const inData = await signIn.json();
    expect(inData.children.find((c) => c.id === childId).status).toBe("SIGNED_IN");

    const twice = await apiPost(
      request,
      "/api/v1/parent-sign-in",
      { pin: PIN, ...NEAR, changes: [{ childId, action: "IN" }] },
      cookies,
    );
    expect(twice.status()).toBe(409);

    const signOut = await apiPost(
      request,
      "/api/v1/parent-sign-in",
      { pin: PIN, ...NEAR, changes: [{ childId, action: "OUT" }] },
      cookies,
    );
    expect(signOut.status()).toBe(200);
    expect((await signOut.json()).children.find((c) => c.id === childId).status).toBe("SIGNED_OUT");

    const record = await prisma.attendance.findFirst({ where: { childId } });
    expect(record.checkedInById).toBe(parentId);
    expect(record.checkedOutById).toBe(parentId);
    expect(record.checkedInAt).not.toBeNull();
    expect(record.checkedOutAt).not.toBeNull();
  });

  test("cannot sign in a child who is not theirs", async ({ request }) => {
    const cookies = await loginAsParent(request);
    const stranger = await prisma.child.create({
      data: { firstName: "E2E Stranger", centerId },
    });
    try {
      const res = await apiPost(
        request,
        "/api/v1/parent-sign-in",
        { pin: PIN, ...NEAR, changes: [{ childId: stranger.id, action: "IN" }] },
        cookies,
      );
      expect(res.status()).toBe(403);
    } finally {
      await prisma.child.delete({ where: { id: stranger.id } });
    }
  });
});
