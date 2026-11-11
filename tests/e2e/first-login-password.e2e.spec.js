// @ts-check
// First sign-in with a temporary password (mustChangePassword): the
// middleware sends everyone to /settings to choose a new one. Global team
// members (GLOBAL_ADMIN only) and SUBSCRIBER users used to be bounced to
// /login there because Settings didn't list their role (production bug,
// 2026-11-11, Permissions & Users > Add User).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();
const stamp = Date.now();
const temp = crypto.randomBytes(9).toString("base64url");
const chosen = `New-${crypto.randomBytes(6).toString("base64url")}`;
const people = [
  { role: "GLOBAL_ADMIN", email: `first-login-global-${stamp}@first-login.local`, lands: /\/global\// },
  { role: "SUBSCRIBER", email: `first-login-subscriber-${stamp}@first-login.local`, lands: /\/(dashboard|terms)/ },
  // Center users with a temporary password AND "I agree" terms pending used to
  // loop between /settings and /terms forever; terms come after the password.
  { role: "TEACHER", email: `first-login-teacher-${stamp}@first-login.local`, lands: /\/(terms|teacher)/ },
];

test.describe.configure({ mode: "serial" });

test.describe("First sign-in password change @e2e", () => {
  test.beforeAll(async () => {
    for (const p of people) {
      await prisma.user.create({
        data: { email: p.email, name: `First Login ${p.role}`, password: await bcrypt.hash(temp, 10), role: p.role, roles: [p.role], mustChangePassword: true },
      });
    }
  });

  test.afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { in: people.map((p) => p.email) } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.termsAcceptance.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  for (const p of people) {
    test(`${p.role} with a temporary password reaches Settings, then their portal`, async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[type="email"]', p.email);
      await page.fill('input[type="password"]', temp);
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/settings\?forcePasswordChange=1/, { timeout: 30000 });
      await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1500);
      expect(new URL(page.url()).pathname).toBe("/settings"); // not bounced to /login

      // No "current password" for a temporary one: just the new one twice.
      const fields = page.locator('input[type="password"]');
      await expect(fields).toHaveCount(2);
      await fields.nth(0).fill(chosen);
      await fields.nth(1).fill(chosen);
      await page.getByRole("button", { name: "Update Password" }).click();

      await page.waitForURL(p.lands, { timeout: 30000 });
      expect(page.url()).not.toContain("/login");
      const user = await prisma.user.findUnique({ where: { email: p.email }, select: { mustChangePassword: true, password: true } });
      expect(user?.mustChangePassword).toBe(false);
      expect(await bcrypt.compare(chosen, user?.password || "")).toBe(true);
    });
  }
});
