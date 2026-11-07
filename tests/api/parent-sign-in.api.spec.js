// @ts-check
// Parent dashboard Sign Children In / Out starts with the parent's own kiosk
// PIN (client sheet 2026-11-07): /api/v1/me/pin-check.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { loginAsParent } = require("../helpers/auth");
const { apiPost } = require("../helpers/api");

const prisma = new PrismaClient();
const TEST_PIN = "482915";

/** The PIN's lookup hash as src/lib/kioskPins.js makes it, with the server's secret from .env. */
function pinLookupOf(pin) {
  const env = {};
  for (const line of fs.readFileSync(path.join(__dirname, "../../.env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^(JWT_SECRET|NEXTAUTH_SECRET)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || env.JWT_SECRET || env.NEXTAUTH_SECRET;
  const key = crypto.createHash("sha256").update(`ameris-kiosk:pin-lookup:${secret}`).digest();
  return crypto.createHmac("sha256", key).update(String(pin)).digest("hex");
}

test.describe("Parent sign in / out PIN check @api", () => {
  test.describe.configure({ mode: "serial" });
  let parentId = null;
  let createdCredential = false;

  test.beforeAll(async () => {
    parentId = (await prisma.user.findUnique({ where: { email: "parent@demo.com" }, select: { id: true } }))?.id ?? null;
  });

  test.afterAll(async () => {
    if (createdCredential && parentId) await prisma.kioskCredential.deleteMany({ where: { userId: parentId } });
    await prisma.$disconnect();
  });

  test("a parent without a PIN is told to set one", async ({ request }) => {
    test.skip(Boolean(await prisma.kioskCredential.findFirst({ where: { userId: parentId, pinLookup: { not: null } } })), "the demo parent already has a PIN");
    const res = await apiPost(request, "/api/v1/me/pin-check", { pin: TEST_PIN }, await loginAsParent(request));
    expect(await res.json()).toEqual({ ok: false, noPin: true });
  });

  test("only the parent's own PIN is accepted", async ({ request }) => {
    test.skip(Boolean(await prisma.kioskCredential.findFirst({ where: { userId: parentId } })), "the demo parent already has a kiosk credential");
    await prisma.kioskCredential.create({ data: { userId: parentId, pinLookup: pinLookupOf(TEST_PIN), pinSetAt: new Date() } });
    createdCredential = true;
    const cookies = await loginAsParent(request);
    expect(await (await apiPost(request, "/api/v1/me/pin-check", { pin: "000000" }, cookies)).json()).toEqual({ ok: false });
    expect(await (await apiPost(request, "/api/v1/me/pin-check", { pin: TEST_PIN }, cookies)).json()).toEqual({ ok: true });
  });
});
