// @ts-check
// A second subscriber account's admin must not see the first account's data
// on list pages that used to return "everything" to admins: policies, form
// templates and submissions, parent FAQs, renewals, messages, checklists,
// evaluations, staff attendance, supply requests, coach notes, behavior plans
// and metrics. Shared documents (no center) belong to one account only.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie, loginAsAdmin } = require("../helpers/auth");
const { apiGet, apiPost, apiDelete, pickDemoCenterId } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only account, created here and removed in afterAll.
const otherAdminEmail = `scope-admin-${stamp}@subscriber-test.local`;
const otherAdminPassword = crypto.randomBytes(9).toString("base64url");

/** ids of the rows in a list response: an array, or the first array inside an object. */
function idsOf(body) {
  const rows = Array.isArray(body)
    ? body
    : Object.values(body || {}).find((value) => Array.isArray(value)) || [];
  return rows.map((row) => row?.id).filter(Boolean);
}

test.describe.configure({ mode: "serial" });

test.describe("Subscriber account scoping @api", () => {
  let accountId = null;
  let otherCenterId = null;
  let otherAdminId = null;
  let demoCenterId = null;
  let demoCookies = null;
  let otherCookies = null;
  const created = { faqs: [], policies: [] };

  test.beforeAll(async ({ request }) => {
    const account = await prisma.subscriberAccount.create({
      data: {
        accountNumber: `C-T${stamp}`,
        name: `Scope Test ${stamp}`,
        status: "ACTIVE",
        maxCenters: 1,
      },
    });
    accountId = account.id;
    const center = await prisma.center.create({
      data: { name: `Scope Test Center ${stamp}`, subscriberAccountId: accountId },
    });
    otherCenterId = center.id;
    const admin = await prisma.user.create({
      data: {
        email: otherAdminEmail,
        name: "Scope Admin",
        password: await bcrypt.hash(otherAdminPassword, 10),
        role: "ADMIN",
        roles: ["ADMIN"],
        subscriberAccountId: accountId,
        centers: { create: { centerId: otherCenterId, role: "ADMIN" } },
      },
    });
    otherAdminId = admin.id;

    demoCookies = await loginAsAdmin(request);
    demoCenterId = pickDemoCenterId(await (await apiGet(request, "/api/v1/centers", demoCookies)).json());
    otherCookies = await getAuthCookie(request, otherAdminEmail, otherAdminPassword);
  });

  test.afterAll(async () => {
    if (created.faqs.length) await prisma.parentFaq.deleteMany({ where: { id: { in: created.faqs } } });
    if (created.policies.length) await prisma.policyDocument.deleteMany({ where: { id: { in: created.policies } } });
    if (otherAdminId) {
      await prisma.centerUser.deleteMany({ where: { userId: otherAdminId } });
      await prisma.user.delete({ where: { id: otherAdminId } });
    }
    if (otherCenterId) {
      await prisma.parentFaq.deleteMany({ where: { centerId: otherCenterId } });
      await prisma.center.delete({ where: { id: otherCenterId } });
    }
    if (accountId) {
      await prisma.parentFaq.deleteMany({ where: { subscriberAccountId: accountId } });
      await prisma.policyDocument.deleteMany({ where: { subscriberAccountId: accountId } });
      await prisma.subscriberAccount.delete({ where: { id: accountId } });
    }
    await prisma.$disconnect();
  });

  test("shared documents with no center stay inside their own account", async ({ request }) => {
    // The demo admin shares a question and a policy with every center.
    const faq = await apiPost(
      request,
      "/api/v1/parent-faqs",
      { question: `Scope question ${stamp}?`, answer: "Demo only.", topic: "general" },
      demoCookies,
    );
    expect(faq.status()).toBe(201);
    const faqId = (await faq.json()).id;
    created.faqs.push(faqId);

    const policy = await apiPost(
      request,
      "/api/v1/policies",
      { category: "POLICY", title: `Scope policy ${stamp}`, url: "https://example.com/policy.pdf", roles: ["PARENT"] },
      demoCookies,
    );
    expect(policy.status()).toBe(201);
    const policyId = (await policy.json()).id;
    created.policies.push(policyId);

    // The other account can't list or open either one.
    expect(idsOf(await (await apiGet(request, "/api/v1/parent-faqs", otherCookies)).json())).not.toContain(faqId);
    expect(idsOf(await (await apiGet(request, "/api/v1/policies", otherCookies)).json())).not.toContain(policyId);
    expect((await apiGet(request, `/api/v1/parent-faqs/${faqId}`, otherCookies)).status()).toBe(404);
    expect((await apiGet(request, `/api/v1/policies/${policyId}`, otherCookies)).status()).toBe(404);
    expect((await apiDelete(request, `/api/v1/parent-faqs/${faqId}`, otherCookies)).status()).toBe(404);

    // Its own shared question is invisible to the demo admin in turn.
    const own = await apiPost(
      request,
      "/api/v1/parent-faqs",
      { question: `Other account question ${stamp}?`, answer: "Other only.", topic: "general" },
      otherCookies,
    );
    expect(own.status()).toBe(201);
    const ownId = (await own.json()).id;
    created.faqs.push(ownId);
    expect(idsOf(await (await apiGet(request, "/api/v1/parent-faqs", otherCookies)).json())).toContain(ownId);
    expect(idsOf(await (await apiGet(request, "/api/v1/parent-faqs", demoCookies)).json())).not.toContain(ownId);

    // Nor can it put a document on the demo center.
    const sneaky = await apiPost(
      request,
      "/api/v1/parent-faqs",
      { question: "Sneaky?", answer: "No.", centerId: demoCenterId },
      otherCookies,
    );
    expect(sneaky.status()).toBe(403);
  });

  test("form templates, submissions and renewals belong to one account", async ({ request }) => {
    const demoTemplates = idsOf(await (await apiGet(request, "/api/v1/forms/templates", demoCookies)).json());
    expect(demoTemplates.length).toBeGreaterThan(0);

    const otherTemplates = idsOf(await (await apiGet(request, "/api/v1/forms/templates", otherCookies)).json());
    expect(otherTemplates.filter((id) => demoTemplates.includes(id))).toEqual([]);
    expect((await apiGet(request, `/api/v1/forms/templates/${demoTemplates[0]}`, otherCookies)).status()).toBe(404);
    expect((await apiGet(request, `/api/v1/forms/templates?centerId=${demoCenterId}`, otherCookies)).status()).toBe(403);

    expect(idsOf(await (await apiGet(request, "/api/v1/forms/submissions", otherCookies)).json())).toEqual([]);

    const renewals = await apiGet(request, "/api/v1/forms/renewals/tracker", otherCookies);
    expect(renewals.status()).toBe(200);
    expect(JSON.stringify(await renewals.json())).not.toContain(demoCenterId);
    expect((await apiGet(request, `/api/v1/forms/renewals/tracker?centerId=${demoCenterId}`, otherCookies)).status()).toBe(403);
  });

  test("lists without a center only cover the admin's own centers", async ({ request }) => {
    const lists = [
      "/api/v1/checklists",
      "/api/v1/daily-checklists",
      "/api/v1/evaluations",
      "/api/v1/staff-attendance",
      "/api/v1/supply-requests",
      "/api/v1/coach/observations",
      "/api/v1/coach/follow-ups",
      "/api/v1/behavior-plans",
      "/api/v1/messages/threads?all=1",
    ];
    for (const path of lists) {
      const demo = await apiGet(request, path, demoCookies);
      const other = await apiGet(request, path, otherCookies);
      expect(demo.status(), path).toBe(200);
      expect(other.status(), path).toBe(200);
      const demoIds = idsOf(await demo.json());
      const otherIds = idsOf(await other.json());
      expect(otherIds.filter((id) => demoIds.includes(id)), path).toEqual([]);
    }

    // Asking for the demo center by name is refused outright.
    expect((await apiGet(request, `/api/v1/messages/threads?all=1&centerId=${demoCenterId}`, otherCookies)).status()).toBe(403);
  });

  test("another account's behavior plans and employees answer 404", async ({ request }) => {
    const plans = idsOf(await (await apiGet(request, "/api/v1/behavior-plans", demoCookies)).json());
    if (plans.length) {
      expect((await apiGet(request, `/api/v1/behavior-plans/${plans[0]}`, otherCookies)).status()).toBe(404);
    }
    const demoAdmin = await prisma.user.findUnique({ where: { email: "admin@demo.com" }, select: { id: true } });
    expect((await apiGet(request, `/api/v1/daily-checklists?staffUserId=${demoAdmin?.id}`, otherCookies)).status()).toBe(404);
  });

  test("the public website shows and notifies only its own account", async ({ request }) => {
    const resource = await apiPost(
      request,
      "/api/v1/policies",
      { category: "RESOURCE", title: `Other resource ${stamp}`, websiteUrl: "https://example.org/other", roles: ["PARENT"], showOnHomePage: true },
      otherCookies,
    );
    expect(resource.status(), await resource.text()).toBe(201);
    const resourceId = (await resource.json()).id;
    created.policies.push(resourceId);
    const publicList = await (await request.get("/api/v1/public/resources")).json();
    expect(publicList.map((r) => r.id)).not.toContain(resourceId);

    const sent = await request.post("/api/v1/public/contact", {
      data: { fullName: `Visitor ${stamp}`, email: "visitor@example.org", subject: "general", message: "A question about enrollment for next fall." },
    });
    expect(sent.status(), await sent.text()).toBe(201);
    const title = `New website inquiry from Visitor ${stamp}`;
    const demoAdmin = await prisma.user.findUnique({ where: { email: "admin@demo.com" }, select: { id: true } });
    expect(await prisma.notification.count({ where: { title, recipientId: demoAdmin?.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { title, recipientId: otherAdminId } })).toBe(0);
    await prisma.notification.deleteMany({ where: { title } });
    await prisma.auditLog.deleteMany({ where: { entityType: "PUBLIC_CONTACT_REQUEST", metadata: { path: ["fullName"], equals: `Visitor ${stamp}` } } });
  });

  test("metrics count only the admin's own centers", async ({ request }) => {
    const res = await apiGet(request, "/api/v1/metrics/me", otherCookies);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.access).toEqual({ centers: 1, classes: 0, children: 0 });
  });
});
