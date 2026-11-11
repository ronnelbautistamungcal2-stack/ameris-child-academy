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
const fs = require("fs");
const path = require("path");
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
        // Home Daycare agrees with the "I agree" box; centers e-sign (tested below).
        pricingSelection: { children: 15, billingCycle: "MONTHLY", programType: "HOME_DAYCARE", homeDaycareProgram: "early-learning", curriculumVersion: "STANDARD" },
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

// Centers sign the Order Form and Subscriber Agreement in DocuSign before
// paying (client 2026-11-11). Signing itself happens on DocuSign's page, so
// it's checked by hand; skipped when the server has no DocuSign settings.
test.describe("Complete Your Enrollment: center e-signing @api", () => {
  const cStamp = `${stamp}c`;
  const cDomain = `esign-test-${cStamp}.local`;
  const pdfName = `test-esign-${cStamp}.pdf`;
  const pdfPath = path.join(__dirname, "..", "..", "public", "uploads", pdfName);
  let globalId = "";
  let leadId = "";
  let token = "";
  let savedAgreements = null;
  let agreementId = "";
  const otherAdminEmail = `other-admin@${cDomain}`;

  test.beforeAll(async ({ request }) => {
    fs.writeFileSync(pdfPath, minimalPdf("Ameris Solutions Software Subscription Agreement (test)"));
    const gEmail = `global@${cDomain}`;
    globalId = (await prisma.user.create({ data: { email: gEmail, name: "E-Sign Global", password: await bcrypt.hash(password, 10), role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] } })).id;
    savedAgreements = await prisma.globalSetting.findUnique({ where: { key: "agreements" } });
    const global = await getAuthCookie(request, gEmail, password);
    const added = await (
      await apiPost(request, "/api/v1/global/settings", { agreement: { name: "Test Subscription Agreement", version: `e-${cStamp}`, effectiveDate: "2026-11-01", fileUrl: `/uploads/${pdfName}` } }, global)
    ).json();
    agreementId = added.agreements.find((a) => a.current).id;
    const lead = await prisma.lead.create({
      data: {
        number: `L-S${cStamp}`,
        source: "QUOTE_REQUEST",
        centerName: `E-Sign Center ${cStamp}`,
        contactName: "E-Sign Contact",
        email: `contact@${cDomain}`,
        locations: 1,
        addOns: ["STEPS_OF_PROGRESSION"],
        pricingSelection: { children: 15, billingCycle: "MONTHLY", programType: "CENTER", curriculumVersion: "STANDARD" },
      },
    });
    leadId = lead.id;
    token = (await (await apiPost(request, `/api/v1/global/leads/${leadId}`, { generateQuote: true }, global)).json()).quoteToken;
  });

  test.afterAll(async () => {
    fs.rmSync(pdfPath, { force: true });
    if (savedAgreements) await prisma.globalSetting.update({ where: { key: "agreements" }, data: { value: savedAgreements.value } });
    else await prisma.globalSetting.deleteMany({ where: { key: "agreements" } });
    await prisma.lead.deleteMany({ where: { id: leadId } });
    const other = await prisma.user.findUnique({ where: { email: otherAdminEmail } });
    if (other) await prisma.centerUser.deleteMany({ where: { userId: other.id } });
    await prisma.user.deleteMany({ where: { OR: [{ id: globalId }, { email: otherAdminEmail }] } });
  });

  test("a center must e-sign before paying; signing opens DocuSign", async ({ request }) => {
    const view = await (await request.get(`/api/v1/solutions/enroll/${token}`)).json();
    test.skip(!view.signing.required, "DocuSign isn't set up on this server");
    expect(view.signing.status).toBeNull();

    // No payment before signing, and no "I agree" shortcut.
    const form = { fullName: "E-Sign Admin", email: `admin@${cDomain}`, password: "a-strong-pass", confirmPassword: "a-strong-pass", agree: true, agreementId };
    const early = await request.post(`/api/v1/solutions/enroll/${token}`, { data: form });
    expect(early.status()).toBe(409);
    expect((await early.json()).error).toMatch(/e-sign/i);

    expect((await request.post(`/api/v1/solutions/enroll/${token}/sign`, { data: { ...form, password: "short", confirmPassword: "short" } })).status()).toBe(400);
    expect((await request.post(`/api/v1/solutions/enroll/${token}/sign`, { data: { ...form, agreementId: "old" } })).status()).toBe(409);

    const res = await request.post(`/api/v1/solutions/enroll/${token}/sign`, { data: form });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).url).toMatch(/^https:\/\/[\w.-]*docusign\.(com|net)\//);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const e = /** @type {any} */ (lead?.enrollment);
    expect(e).toMatchObject({ fullName: "E-Sign Admin", email: `admin@${cDomain}`, signing: { status: "SENT" } });
    expect(e.signing.envelopeId).toBeTruthy();
    expect(e.passwordHash).toMatch(/^\$2/);
    expect(JSON.stringify(e)).not.toContain("a-strong-pass");

    const after = await (await request.get(`/api/v1/solutions/enroll/${token}`)).json();
    expect(after.signing).toMatchObject({ required: true, status: "SENT", signer: { fullName: "E-Sign Admin" } });
    expect((await request.post(`/api/v1/solutions/enroll/${token}`, { data: {} })).status()).toBe(409); // still unsigned
  });

  test("signed copies are only for Ameris staff and the account's own admins", async ({ request }) => {
    const demo = await prisma.subscriberAccount.findFirst({ where: { accountNumber: "C-1001" } });
    const other = await prisma.user.create({
      data: { email: otherAdminEmail, name: "Other Admin", password: await bcrypt.hash(password, 10), role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: null },
    });
    const cookie = await getAuthCookie(request, otherAdminEmail, password);
    // An admin of another (or no) account can't open C-1001's agreement.
    expect((await request.get(`/api/v1/signed-agreements/${demo?.id}`, { headers: { cookie } })).status()).toBe(403);
    // A Global admin can, but there's no signed copy on file for the demo account.
    const global = await getAuthCookie(request, `global@${cDomain}`, password);
    expect((await request.get(`/api/v1/signed-agreements/${demo?.id}`, { headers: { cookie: global } })).status()).toBe(404);
    expect(other.id).toBeTruthy();
  });
});

function minimalPdf(text) {
  const content = `BT /F1 14 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
