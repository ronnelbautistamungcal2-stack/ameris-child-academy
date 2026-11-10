// @ts-check
// "I agree" terms at first login (client 2026-11-11): staff and parents
// accept the current End-User Terms of Use; each acceptance records the
// user, version, date and time and IP. Publishing a new version asks again.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only people, removed in afterAll, and a test version of the terms that
// is deleted again (so the seeded version is back in force).
const staffEmail = `terms-staff-${stamp}@terms-test.local`;
const globalEmail = `terms-global-${stamp}@terms-test.local`;
const password = crypto.randomBytes(9).toString("base64url");
// The staff member must keep their pending terms (the helper accepts them by default).
const RAW = { acceptTerms: false };

test.describe.configure({ mode: "serial" });

test.describe("Terms acceptance @api", () => {
  const userIds = [];
  let createdDocId = "";

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    userIds.push((await prisma.user.create({ data: { email: staffEmail, name: "Terms Staff", password: hash, role: "TEACHER", roles: ["TEACHER"] } })).id);
    userIds.push((await prisma.user.create({ data: { email: globalEmail, name: "Terms Global", password: hash, role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] } })).id);
  });

  test.afterAll(async () => {
    await prisma.termsAcceptance.deleteMany({ where: { userId: { in: userIds } } });
    if (createdDocId) {
      await prisma.termsAcceptance.deleteMany({ where: { documentId: createdDocId } });
      await prisma.termsDocument.deleteMany({ where: { id: createdDocId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("a new staff member must accept the End-User Terms; pages send them to /terms", async ({ request }) => {
    const staff = await getAuthCookie(request, staffEmail, password, RAW);
    const { pending } = await (await apiGet(request, "/api/v1/terms", staff)).json();
    expect(pending.map((d) => d.kind)).toEqual(["END_USER"]);
    expect(pending[0].title).toBe("End-User Terms of Use");
    expect(pending[0].body).toContain("Your account is personal to you");

    const session = await (await apiGet(request, "/api/auth/session", staff)).json();
    expect(session.user.termsPending).toBe(true);
    const page = await request.get("/admin/children", { headers: { Cookie: staff }, maxRedirects: 0 });
    expect(page.status()).toBe(307);
    expect(page.headers().location).toContain("/terms?callbackUrl=%2Fadmin%2Fchildren");
  });

  test("I agree records who, which version, when and from where", async ({ request }) => {
    const staff = await getAuthCookie(request, staffEmail, password, RAW);
    const { pending } = await (await apiGet(request, "/api/v1/terms", staff)).json();
    expect((await apiPost(request, "/api/v1/terms", { documentIds: ["not-a-version"] }, staff)).status()).toBe(409);
    const res = await apiPost(request, "/api/v1/terms", { documentIds: [pending[0].id] }, staff);
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).pending).toEqual([]);

    const row = await prisma.termsAcceptance.findFirst({ where: { userId: userIds[0], documentId: pending[0].id } });
    expect(row).toBeTruthy();
    expect(row?.role).toBe("TEACHER");
    expect(row?.ipAddress).toBeTruthy();
    expect(row?.userAgent).toBeTruthy();
    expect(Math.abs(Date.now() - new Date(row?.acceptedAt || 0).getTime())).toBeLessThan(120000);

  });

  test("after accepting, a new sign-in isn't sent to /terms", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000" });
    try {
      const { csrfToken } = await (await ctx.get("/api/auth/csrf")).json();
      await ctx.post("/api/auth/callback/credentials?json=true", { form: { csrfToken, email: staffEmail, password }, maxRedirects: 0, failOnStatusCode: false });
      expect((await (await ctx.get("/api/auth/session")).json()).user.termsPending).toBe(false);
      const page = await ctx.get("/dashboard", { maxRedirects: 0 });
      expect(page.headers().location || "").not.toContain("/terms");
    } finally {
      await ctx.dispose();
    }
  });

  test("Ameris-only global admins aren't asked; they publish versions and see who accepted", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    expect((await (await apiGet(request, "/api/v1/terms", global)).json()).pending).toEqual([]);

    const list = await (await apiGet(request, "/api/v1/global/terms", global)).json();
    const endUser = list.kinds.find((k) => k.value === "END_USER");
    const current = endUser.versions.find((v) => v.current);
    const who = await (await apiGet(request, `/api/v1/global/terms/${current.id}?q=${encodeURIComponent(staffEmail)}`, global)).json();
    expect(who.acceptances.map((a) => [a.email, a.role])).toEqual([[staffEmail, "TEACHER"]]);

    expect((await apiPost(request, "/api/v1/global/terms", { kind: "END_USER", version: current.version, title: "x", body: "x".repeat(30) }, global)).status()).toBe(409);
    const published = await apiPost(
      request,
      "/api/v1/global/terms",
      { kind: "END_USER", version: `test-${stamp}`, title: "End-User Terms of Use", body: "Updated terms for the test. ".repeat(3) },
      global,
    );
    expect(published.status(), await published.text()).toBe(201);
    createdDocId = (await published.json()).id;

    // The new version is in force: the staff member is asked again.
    const staff = await getAuthCookie(request, staffEmail, password, RAW);
    const again = await (await apiGet(request, "/api/v1/terms", staff)).json();
    expect(again.pending.map((d) => d.id)).toEqual([createdDocId]);

    const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
    expect((await apiGet(request, "/api/v1/global/terms", demo)).status()).toBe(403);
  });
});
