// @ts-check
// Ameris Solutions website forms and Global admin > Sales & Leads
// (client mockups 2026-11-06, priority 2026-11-11).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost, apiPatch } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only leads use this email domain and are removed in afterAll.
const domain = `leads-${stamp}.test.local`;
const globalEmail = `leads-global-${stamp}@leads-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

test.describe.configure({ mode: "serial" });

test.describe("Sales & Leads @api", () => {
  let userId = "";
  let leadId = "";
  let token = "";

  test.beforeAll(async () => {
    userId = (
      await prisma.user.create({ data: { email: globalEmail, name: "Leads Global", password: await bcrypt.hash(password, 10), role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] } })
    ).id;
  });

  test.afterAll(async () => {
    await prisma.lead.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
    await prisma.notification.deleteMany({ where: { recipientId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("the website's Request a Quote creates a New Lead", async ({ request }) => {
    const options = await (await request.get("/api/v1/solutions/options")).json();
    expect(options.ageGroups.map((g) => g.key)).toContain("toddlers");
    expect(options.ageGroups[0].standard).toBeUndefined(); // no prices on the public site

    const bad = await request.post("/api/v1/solutions/quote-request", { data: { centerName: "x", contactName: "", email: `a@${domain}` } });
    expect(bad.status()).toBe(400);

    const res = await request.post("/api/v1/solutions/quote-request", {
      data: {
        centerName: `Sunny Day ${stamp}`,
        contactName: "Jessica Miller",
        email: `jessica@${domain}`,
        phone: "(801) 555-4827",
        bestTime: "Afternoon (12 PM – 4 PM)",
        locations: 1,
        addOns: ["STEPS_OF_PROGRESSION", "TEACHER_TRAINING", "CURRICULUM"],
        pricingSelection: { children: 15, programType: "CENTER", curriculumVersion: "FAITH_BASED", classrooms: { toddlers: 2, "3-years": 1 } },
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const lead = await prisma.lead.findFirst({ where: { email: `jessica@${domain}` } });
    expect(lead).toMatchObject({ status: "NEW", source: "QUOTE_REQUEST", locations: 1 });
    leadId = lead?.id || "";

    // The honeypot field quietly drops bot submissions.
    await request.post("/api/v1/solutions/quote-request", { data: { website: "spam", centerName: "Bot", contactName: "Bot", email: `bot@${domain}` } });
    expect(await prisma.lead.count({ where: { email: `bot@${domain}` } })).toBe(0);
  });

  test("Contact Us becomes a lead too", async ({ request }) => {
    expect((await request.post("/api/v1/solutions/contact", { data: { contactName: "Ann", email: `ann@${domain}`, subject: "Nope", message: "Hi" } })).status()).toBe(400);
    const res = await request.post("/api/v1/solutions/contact", {
      data: { contactName: "Ann Parker", email: `ann@${domain}`, subject: "Request a demo", message: "Can we see a demo at the conference?" },
    });
    expect(res.status(), await res.text()).toBe(201);
    const lead = await prisma.lead.findFirst({ where: { email: `ann@${domain}` } });
    expect(lead?.source).toBe("CONTACT_FORM");
    expect(lead?.about).toContain("Request a demo");
  });

  test("Sales & Leads: list, save, Generate Quote, and the public quote page", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const list = await (await apiGet(request, `/api/v1/global/leads?q=${encodeURIComponent(`Sunny Day ${stamp}`)}`, global)).json();
    expect(list.leads.map((l) => l.id)).toEqual([leadId]);

    const saved = await (await apiPatch(request, `/api/v1/global/leads/${leadId}`, { status: "CONTACTED", pricingSelection: { children: 15, programType: "CENTER", curriculumVersion: "FAITH_BASED", classrooms: { toddlers: 2, "3-years": 1 }, discountId: "dccs" } }, global)).json();
    expect(saved.status).toBe("CONTACTED");
    expect(saved.activities.map((a) => a.description)).toContain("Status changed to Contacted.");
    // 20 x $17.45 + SOP 20 x $1.35 + TT 20 x $1.25 + 2 x $79 + $89 = $648, DCCS 50% off.
    expect(saved.liveQuote.monthly).toBe(32400);

    const generated = await (await apiPost(request, `/api/v1/global/leads/${leadId}`, { generateQuote: true }, global)).json();
    expect(generated.quoteNumber).toMatch(/^Q-\d{5,}$/);
    expect(generated.status).toBe("QUOTE_SENT");
    token = generated.quoteToken;

    const pub = await (await request.get(`/api/v1/solutions/quotes/${token}`)).json();
    expect(pub.number).toBe(generated.quoteNumber);
    expect(pub.preparedFor.contactName).toBe("Jessica Miller");
    expect(pub.quote.monthly).toBe(32400);
    expect(pub.quote.curriculumDetails).toEqual([
      { label: "Toddlers", classrooms: 2 },
      { label: "3 Years", classrooms: 1 },
    ]);
    expect((await request.get("/api/v1/solutions/quotes/not-a-real-token-at-all")).status()).toBe(404);

    // The website pages open without signing in.
    for (const path of ["/solutions", "/solutions/plans", "/solutions/contact", "/solutions/request-quote", `/solutions/quote/${token}`]) {
      const page = await request.get(path, { maxRedirects: 0 });
      expect(page.status(), path).toBe(200);
    }

    const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
    expect((await apiGet(request, "/api/v1/global/leads", demo)).status()).toBe(403);
  });
});
