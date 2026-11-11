// @ts-check
// Global admin Reports, Permissions & Users and Settings > General
// (client mockups 2026-11-06, priority 2026-11-11).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiPatch } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only people and settings; removed or restored in afterAll.
const adminEmail = `gap-admin-${stamp}@gap-test.local`;
const salesEmail = `gap-sales-${stamp}@gap-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

test.describe.configure({ mode: "serial" });

test.describe("Global admin pages @api", () => {
  const userIds = [];
  let savedGeneral = null;
  let savedAgreements = null;
  let quoteTemplate = null;

  test.beforeAll(async () => {
    userIds.push(
      (await prisma.user.create({ data: { email: adminEmail, name: "GAP Admin", password: await bcrypt.hash(password, 10), role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] } })).id,
    );
    savedGeneral = await prisma.globalSetting.findUnique({ where: { key: "general" } });
    savedAgreements = await prisma.globalSetting.findUnique({ where: { key: "agreements" } });
    quoteTemplate = await prisma.emailTemplate.findUnique({ where: { key: "QUOTE" } });
  });

  test.afterAll(async () => {
    const restore = async (key, row) => {
      if (row) await prisma.globalSetting.update({ where: { key }, data: { value: row.value } });
      else await prisma.globalSetting.deleteMany({ where: { key } });
    };
    await restore("general", savedGeneral);
    await restore("agreements", savedAgreements);
    if (quoteTemplate) await prisma.emailTemplate.update({ where: { id: quoteTemplate.id }, data: { name: quoteTemplate.name, subject: quoteTemplate.subject, body: quoteTemplate.body, active: quoteTemplate.active } });
    await prisma.user.deleteMany({ where: { OR: [{ id: { in: userIds } }, { email: salesEmail }] } });
    await prisma.$disconnect();
  });

  test("every report loads with columns and rows", async ({ request }) => {
    const admin = await getAuthCookie(request, adminEmail, password);
    const { reports } = await (await apiGet(request, "/api/v1/global/reports", admin)).json();
    expect(reports.map((r) => r.key)).toEqual(["subscriptions", "revenue", "outstanding", "sales", "support", "addons", "activity"]);
    for (const r of reports) {
      const res = await apiGet(request, `/api/v1/global/reports?report=${r.key}&from=2026-01-01&to=2026-12-31`, admin);
      expect(res.status(), r.key).toBe(200);
      const body = await res.json();
      expect(body.columns.length, r.key).toBeGreaterThan(0);
      expect(Array.isArray(body.rows), r.key).toBe(true);
      expect(body.stats.length, r.key).toBeGreaterThan(0);
    }
    const subs = await (await apiGet(request, "/api/v1/global/reports?report=subscriptions", admin)).json();
    expect(subs.rows.some((row) => row.accountNumber === "C-1001")).toBe(true);
    expect((await apiGet(request, "/api/v1/global/reports?report=nope", admin)).status()).toBe(404);
  });

  test("a Sales team member sees Sales & Leads but not Settings or Permissions & Users", async ({ request }) => {
    const admin = await getAuthCookie(request, adminEmail, password);
    // A global admin from before roles is a Global Administrator.
    const me = await (await apiGet(request, "/api/v1/global/me", admin)).json();
    expect(me.teamRole).toBe("GLOBAL_ADMINISTRATOR");
    expect(me.manageUsers).toBe(true);

    const created = await apiPost(request, "/api/v1/global/users", { name: "GAP Sales", email: salesEmail, password, teamRole: "SALES" }, admin);
    expect(created.status(), await created.text()).toBe(201);
    const sales = await created.json();
    expect(sales.permissions.SALES_LEADS).toEqual(["VIEW", "ADD", "EDIT", "DELETE"]);
    expect(sales.permissions.SETTINGS).toEqual([]);
    // New team members choose their own password first; clear that for the test.
    await prisma.user.update({ where: { id: sales.id }, data: { mustChangePassword: false } });

    const salesCookie = await getAuthCookie(request, salesEmail, password);
    expect((await apiGet(request, "/api/v1/global/leads", salesCookie)).status()).toBe(200);
    expect((await apiGet(request, "/api/v1/global/subscribers", salesCookie)).status()).toBe(200);
    expect((await apiGet(request, "/api/v1/global/pricing-sets", salesCookie)).status()).toBe(200); // prices on the lead page
    expect((await apiGet(request, "/api/v1/global/reports", salesCookie)).status()).toBe(200);
    expect((await apiGet(request, "/api/v1/global/settings", salesCookie)).status()).toBe(403);
    expect((await apiGet(request, "/api/v1/global/users", salesCookie)).status()).toBe(403);
    expect((await apiGet(request, "/api/v1/global/support", salesCookie)).status()).toBe(200); // view only
    expect((await apiPost(request, "/api/v1/global/support", { subject: "x", body: "y" }, salesCookie)).status()).toBe(403);

    // A custom matrix: take Reports away.
    const perms = { ...sales.permissions, REPORTS: [] };
    const updated = await (await apiPatch(request, `/api/v1/global/users/${sales.id}`, { permissions: perms }, admin)).json();
    expect(updated.customPermissions).toBe(true);
    expect((await apiGet(request, "/api/v1/global/reports", salesCookie)).status()).toBe(403);

    // Disabled team members lose access.
    await apiPatch(request, `/api/v1/global/users/${sales.id}`, { disabled: true }, admin);
    expect((await apiGet(request, "/api/v1/global/leads", salesCookie)).status()).toBe(403);

    // A Global Administrator can't demote themselves.
    const meUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    const self = await apiPatch(request, `/api/v1/global/users/${meUser?.id}`, { teamRole: "SALES" }, admin);
    expect(self.status()).toBe(400);
  });

  test("Settings > General saves company, email, templates and agreements", async ({ request }) => {
    const admin = await getAuthCookie(request, adminEmail, password);
    const data = await (await apiGet(request, "/api/v1/global/settings", admin)).json();
    expect(data.general.company.name).toBeTruthy();
    expect(data.templates.map((t) => t.key)).toContain("QUOTE");

    const bad = await apiPut(request, "/api/v1/global/settings", { general: { ...data.general, company: { ...data.general.company, email: "nope" } } }, admin);
    expect(bad.status()).toBe(400);
    const ok = await apiPut(
      request,
      "/api/v1/global/settings",
      { general: { ...data.general, automated: { ...data.general.automated, renewalReminderDaysBefore: 45 }, notifications: { ...data.general.notifications, systemUpdates: true } } },
      admin,
    );
    expect(ok.status(), await ok.text()).toBe(200);
    expect((await ok.json()).general.automated.renewalReminderDaysBefore).toBe(45);

    const t = data.templates.find((x) => x.key === "QUOTE");
    const saved = await (await apiPut(request, `/api/v1/global/email-templates/${t.id}`, { subject: "Thanks from Ameris", active: false }, admin)).json();
    expect(saved).toMatchObject({ subject: "Thanks from Ameris", active: false });

    expect((await apiPost(request, "/api/v1/global/settings", { agreement: { name: "Agreement", version: "v1", effectiveDate: "2026-01-01", fileUrl: "https://evil.example/x.pdf" } }, admin)).status()).toBe(400);
    const a1 = await (await apiPost(request, "/api/v1/global/settings", { agreement: { name: "Test Agreement", version: "v1.0", effectiveDate: "2025-01-01", fileUrl: "/uploads/test-v1.pdf" } }, admin)).json();
    const a2 = await (await apiPost(request, "/api/v1/global/settings", { agreement: { name: "Test Agreement", version: "v2.0", effectiveDate: "2026-11-01", fileUrl: "/uploads/test-v2.pdf" } }, admin)).json();
    expect(a2.agreements.find((x) => x.current).version).toBe("v2.0");
    const old = a1.agreements.find((x) => x.version === "v1.0");
    const back = await (await apiPatch(request, "/api/v1/global/settings", { currentAgreementId: old.id }, admin)).json();
    expect(back.agreements.find((x) => x.current).version).toBe("v1.0");
  });
});
