// @ts-check
// An admin who also holds Coach and Student Support, signed in as one of
// those roles (client sheet 2026-11-07: "It is not pulling up any children",
// "It says there are no classes", coach Student List "Forbidden"). Admins
// with no subscriber account reach every center without membership rows, and
// the Coach / Student Support checks used to treat that as "no centers".
const { test, expect, request: playwrightRequest } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only account, created here and removed in afterAll.
const email = `multirole-${stamp}@subscriber-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

/** A signed-in API context for the test user, switched to `role`. */
async function signedInAs(baseURL, role) {
  const ctx = await playwrightRequest.newContext({ baseURL });
  const { csrfToken } = await (await ctx.get("/api/auth/csrf")).json();
  await ctx.post("/api/auth/callback/credentials", { form: { csrfToken, email, password, json: "true" } });
  const update = await ctx.post("/api/auth/session", { data: { csrfToken, data: { user: { role } } } });
  expect(update.ok()).toBe(true);
  const session = await (await ctx.get("/api/auth/session")).json();
  expect(session?.user?.role).toBe(role);
  return ctx;
}

test.describe("Admin signed in as another role @api", () => {
  let userId = null;
  let demoCenterId = null;

  test.beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email,
        name: "Multi Role Admin",
        password: await bcrypt.hash(password, 10),
        role: "ADMIN",
        roles: ["ADMIN", "STUDENT_SUPPORT", "COACH"],
      },
    });
    userId = user.id;
    demoCenterId = (await prisma.center.findFirst({ where: { name: "Demo Center" }, select: { id: true } }))?.id ?? null;
  });

  test.afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("as Student Support they see the children to assess", async ({ baseURL }) => {
    const ctx = await signedInAs(baseURL, "STUDENT_SUPPORT");
    const children = await (await ctx.get("/api/v1/sop/tracking")).json();
    expect(Array.isArray(children) && children.length).toBeGreaterThan(0);
    const ipp = await ctx.get("/api/v1/ipp/children");
    expect(ipp.status()).toBe(200);
    await ctx.dispose();
  });

  test("as Coach they see classes and the Student List's red flags", async ({ baseURL }) => {
    const ctx = await signedInAs(baseURL, "COACH");
    const classes = await (await ctx.get("/api/v1/reports/classes")).json();
    expect(Array.isArray(classes) && classes.length).toBeGreaterThan(0);
    const flags = await ctx.get(`/api/v1/child-flags?centerId=${demoCenterId}`);
    expect(flags.status(), await flags.text()).toBe(200);
    await ctx.dispose();
  });
});
