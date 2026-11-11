// @ts-check
// Complete Your Enrollment (client mockup Home-Pages-07): agreement, the
// administrator login, Stripe Checkout and finishing. Paying itself happens on
// Stripe's page, so it's checked by hand with a test card; here we check
// everything around it. Stripe must be in test mode (sk_test_) or the
// checkout step is skipped.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiPost } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
const domain = `enroll-test-${stamp}.local`;
const globalEmail = `global@${domain}`;
const password = crypto.randomBytes(9).toString("base64url");

test.describe.configure({ mode: "serial" });

test.describe("Complete Your Enrollment @api", () => {
  let globalId = "";
  let leadId = "";
  let token = "";
  let savedAgreements = null;
  let agreementId = "";

  test.beforeAll(async ({ request }) => {
    globalId = (
      await prisma.user.create({ data: { email: globalEmail, name: "Enroll Global", password: await bcrypt.hash(password, 10), role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] } })
    ).id;
    savedAgreements = await prisma.globalSetting.findUnique({ where: { key: "agreements" } });
    const global = await getAuthCookie(request, globalEmail, password);
    const added = await (
      await apiPost(request, "/api/v1/global/settings", { agreement: { name: "Test Subscription Agreement", version: `t-${stamp}`, effectiveDate: "2026-11-01", fileUrl: "/uploads/test-agreement.pdf" } }, global)
    ).json();
    agreementId = added.agreements.find((a) => a.current).id;

    const lead = await prisma.lead.create({
      data: {
        number: `L-T${stamp}`,
        source: "QUOTE_REQUEST",
        centerName: `Enroll Center ${stamp}`,
        contactName: "Enroll Contact",
        email: `contact@${domain}`,
        locations: 1,
        addOns: ["STEPS_OF_PROGRESSION"],
        pricingSelection: { children: 15, billingCycle: "MONTHLY", programType: "CENTER", curriculumVersion: "STANDARD" },
      },
    });
    leadId = lead.id;
    const quoted = await (await apiPost(request, `/api/v1/global/leads/${leadId}`, { generateQuote: true }, global)).json();
    token = quoted.quoteToken;
  });

  test.afterAll(async () => {
    if (savedAgreements) await prisma.globalSetting.update({ where: { key: "agreements" }, data: { value: savedAgreements.value } });
    else await prisma.globalSetting.deleteMany({ where: { key: "agreements" } });
    await prisma.lead.deleteMany({ where: { id: leadId } });
    await prisma.user.deleteMany({ where: { id: globalId } });
    await prisma.$disconnect();
  });

  test("the page shows the charges, the agreement and that they haven't enrolled", async ({ request }) => {
    const res = await request.get(`/api/v1/solutions/enroll/${token}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(false);
    expect(body.expired).toBe(false);
    expect(body.agreement).toMatchObject({ id: agreementId, source: "FILE", url: "/uploads/test-agreement.pdf" });
    expect(body.charges.billingCycle).toBe("MONTHLY");
    expect(body.charges.recurringAmount).toBeGreaterThan(0);
    // Through the 15th the first month is full; after it, half.
    const half = new Date().getDate() > 15;
    expect(body.charges.dueToday).toBe(half ? Math.round(body.charges.recurringAmount / 2) : body.charges.recurringAmount);
    expect((await request.get("/api/v1/solutions/enroll/not-a-real-token-123456")).status()).toBe(404);
  });

  test("the form is checked before payment", async ({ request }) => {
    const url = `/api/v1/solutions/enroll/${token}`;
    const good = { fullName: "Enroll Admin", email: `admin@${domain}`, password: "a-strong-pass", confirmPassword: "a-strong-pass", agree: true, agreementId };
    expect((await request.post(url, { data: { ...good, agree: false } })).status()).toBe(400);
    expect((await request.post(url, { data: { ...good, password: "short", confirmPassword: "short" } })).status()).toBe(400);
    expect((await request.post(url, { data: { ...good, confirmPassword: "different" } })).status()).toBe(400);
    expect((await request.post(url, { data: { ...good, email: "nope" } })).status()).toBe(400);
    expect((await request.post(url, { data: { ...good, agreementId: "old-version" } })).status()).toBe(409);
    expect((await request.post(url, { data: { ...good, email: globalEmail } })).status()).toBe(409); // already has an account
  });

  test("a valid form opens Stripe Checkout; an unpaid session doesn't create an account", async ({ request }) => {
    const res = await request.post(`/api/v1/solutions/enroll/${token}`, {
      data: { fullName: "Enroll Admin", email: `admin@${domain}`, password: "a-strong-pass", confirmPassword: "a-strong-pass", agree: true, agreementId },
    });
    test.skip(res.status() === 503, "Stripe isn't set up on this server");
    expect(res.status(), await res.text()).toBe(200);
    const { url } = await res.json();
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const e = /** @type {any} */ (lead?.enrollment);
    expect(e).toMatchObject({ fullName: "Enroll Admin", email: `admin@${domain}`, agreement: { id: agreementId } });
    expect(e.passwordHash).toMatch(/^\$2/);
    expect(JSON.stringify(e)).not.toContain("a-strong-pass");
    expect(e.acceptedAt).toBeTruthy();
    expect(e.checkoutSessionId).toMatch(/^cs_test_/);

    const finish = await request.post(`/api/v1/solutions/enroll/${token}/finish`, { data: { sessionId: e.checkoutSessionId } });
    expect(finish.status()).toBe(409); // not paid
    expect((await request.post(`/api/v1/solutions/enroll/${token}/finish`, { data: { sessionId: "nope" } })).status()).toBe(400);
    expect(await prisma.subscriberAccount.count({ where: { stripeCheckoutSessionId: e.checkoutSessionId } })).toBe(0);
  });

  test("the webhook rejects unsigned calls; expired quotes can't enroll", async ({ request }) => {
    const hook = await request.post("/api/v1/solutions/stripe-webhook", { data: { type: "checkout.session.completed" }, headers: { "stripe-signature": "t=1,v1=bad" } });
    expect([400, 503]).toContain(hook.status());

    await prisma.lead.update({ where: { id: leadId }, data: { quoteExpiresAt: new Date("2026-01-01T00:00:00Z") } });
    expect((await (await request.get(`/api/v1/solutions/enroll/${token}`)).json()).expired).toBe(true);
    const res = await request.post(`/api/v1/solutions/enroll/${token}`, {
      data: { fullName: "Enroll Admin", email: `admin@${domain}`, password: "a-strong-pass", confirmPassword: "a-strong-pass", agree: true, agreementId },
    });
    expect(res.status()).toBe(409);
  });
});
