// @ts-check
// Daily Log photos: list by classroom and dates, download as a .zip (client
// sheet 10-29 (11), row 22).
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { loginAsCoach, loginAsTeacher } = require("../helpers/auth");
const { apiGet } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
const fileName = `qa-photo-${stamp}.png`;
const filePath = path.join(process.cwd(), "public", "uploads", fileName);
// A 1x1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.describe("Daily Log photos @api", () => {
  let center;
  let child;
  let log;

  test.beforeAll(async () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, PNG);
    center = await prisma.center.findFirst({ where: { name: "Demo Center" } });
    child = await prisma.child.create({ data: { firstName: "Photo", lastName: `Kid${stamp}`, centerId: center.id } });
    const coach = await prisma.user.findUnique({ where: { email: "coach@demo.com" } });
    log = await prisma.activityLog.create({ data: { childId: child.id, type: "ACTIVITY", details: { media: [`/uploads/${fileName}`] }, recordedById: coach.id } });
  });

  test.afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { childId: child.id } });
    await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
    fs.rmSync(filePath, { force: true });
    await prisma.$disconnect();
  });

  test("a coach lists the photos and downloads them as a zip", async ({ request }) => {
    const coach = await loginAsCoach(request);
    const today = new Date().toISOString().slice(0, 10);
    const q = new URLSearchParams({ centerId: center.id, from: "2020-01-01", to: today });
    const res = await apiGet(request, `/api/v1/activities/photos?${q}`, coach);
    expect(res.status(), await res.text()).toBe(200);
    const mine = (await res.json()).photos.filter((p) => p.url === `/uploads/${fileName}`);
    expect(mine).toHaveLength(1);
    expect(mine[0].childName).toBe(`Photo Kid${stamp}`);

    const zip = await apiGet(request, `/api/v1/activities/photos?${q}&download=zip&only=${encodeURIComponent(`/uploads/${fileName}`)}`, coach);
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toContain("application/zip");
    const body = await zip.body();
    expect(body.subarray(0, 2).toString()).toBe("PK");
    expect(body.includes(PNG)).toBe(true);

    expect((await apiGet(request, `/api/v1/activities/photos?${q}`, await loginAsTeacher(request))).status()).toBe(403);
  });
});
