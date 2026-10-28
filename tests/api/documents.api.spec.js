// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsParent, loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Phase 7a Policies & Procedures and Additional Resources: admins choose the
// roles; everyone else sees the active ones for their role; a website
// resource can be added to the public Resources page.
test.describe("Policies and additional resources (Phase 7a) @api", () => {
  test.describe.configure({ mode: "serial" });
  const stamp = Date.now();
  const ids = [];

  test.afterAll(async () => {
    await prisma.policyDocument.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test("admins add a staff-only policy; teachers see it, parents don't", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    // Subscribers can't be picked any more.
    expect((await apiPost(request, "/api/v1/policies", { category: "POLICY", title: "x", url: "/uploads/x.pdf", roles: ["SUBSCRIBER"] }, admin)).status()).toBe(400);
    const res = await apiPost(request, "/api/v1/policies", {
      category: "POLICY", title: `QA Staff Handbook ${stamp}`, url: "/uploads/handbook.pdf", roles: ["TEACHER", "HR_STAFF"], version: "2026-2027",
    }, admin);
    expect(res.status(), await res.text()).toBe(201);
    const doc = await res.json();
    ids.push(doc.id);
    expect(doc).toMatchObject({ version: "2026-2027", active: true });

    const teacherDocs = await (await apiGet(request, "/api/v1/policies?category=POLICY", await loginAsTeacher(request))).json();
    expect(teacherDocs.map((d) => d.id)).toContain(doc.id);
    const parentDocs = await (await apiGet(request, "/api/v1/policies?category=POLICY", await loginAsParent(request))).json();
    expect(parentDocs.map((d) => d.id)).not.toContain(doc.id);

    // Inactive documents drop off for everyone but admins.
    expect((await apiPut(request, `/api/v1/policies/${doc.id}`, { active: false }, admin)).status()).toBe(200);
    const after = await (await apiGet(request, "/api/v1/policies?category=POLICY", await loginAsTeacher(request))).json();
    expect(after.map((d) => d.id)).not.toContain(doc.id);
  });

  test("a website resource shows on the public Resources page when added to the home page", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    expect((await apiPost(request, "/api/v1/policies", { category: "RESOURCE", title: "No link", roles: ["PARENT"] }, admin)).status()).toBe(400);
    const res = await apiPost(request, "/api/v1/policies", {
      category: "RESOURCE",
      title: `QA Food Bank ${stamp}`,
      websiteUrl: "https://example.org/food-bank",
      contactEmail: "help@example.org",
      contactPhone: "(801) 555-0100",
      roles: ["PARENT", "TEACHER"],
      showOnHomePage: true,
    }, admin);
    expect(res.status(), await res.text()).toBe(201);
    const doc = await res.json();
    ids.push(doc.id);
    expect(doc.url).toBe("https://example.org/food-bank");

    const publicList = await (await request.get("/api/v1/public/resources")).json();
    expect(publicList.find((r) => r.id === doc.id)).toMatchObject({ href: "https://example.org/food-bank" });

    const parentDocs = await (await apiGet(request, "/api/v1/policies?category=RESOURCE", await loginAsParent(request))).json();
    expect(parentDocs.find((d) => d.id === doc.id)).toMatchObject({ contactEmail: "help@example.org" });

    await apiPut(request, `/api/v1/policies/${doc.id}`, { showOnHomePage: false }, admin);
    const hidden = await (await request.get("/api/v1/public/resources")).json();
    expect(hidden.map((r) => r.id)).not.toContain(doc.id);
  });
});
