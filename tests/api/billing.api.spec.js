// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, loginAsParent, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Phase 7b Billing (client mockups 09-01..09) on a throwaway center.
test.describe("Billing: parent fees, invoices and payments (Phase 7b) @api", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let coach;
  let parent;
  let child;
  let otherChild;
  let invoiceId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Billing 7b ${Date.now()}` }, admin)).json();
    [coach, parent] = await Promise.all(["coach@demo.com", "parent@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })));
    await prisma.centerUser.create({ data: { userId: coach.id, centerId: center.id, role: "COACH" } });
    child = await prisma.child.create({
      data: { firstName: "Jacob", lastName: "Anders", centerId: center.id, parentId: parent.id, parentContacts: [{ name: "Sarah Anders", address: "1234 Maple Drive", phone: "801-555-1234" }] },
    });
    otherChild = await prisma.child.create({ data: { firstName: "Not", lastName: "Theirs", centerId: center.id } });
  });

  test.afterAll(async ({ request }) => {
    await prisma.notification.deleteMany({ where: { recipientId: parent.id, title: "New charge on your account", body: { contains: "QA" } } });
    await prisma.child.deleteMany({ where: { id: { in: [child?.id, otherChild?.id].filter(Boolean) } } });
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("a coach adds a charge; it lands on the parent's invoice and they are told", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const parents = await (await apiGet(request, `/api/v1/billing/parents?centerId=${center.id}`, coachCookies)).json();
    expect(parents.find((p) => p.id === parent.id).children.map((c) => c.name)).toEqual(["Jacob Anders"]);

    // A child who isn't the parent's is refused.
    expect((await apiPost(request, "/api/v1/billing/charges", { centerId: center.id, parentId: parent.id, date: "2026-09-22", rows: [{ childId: otherChild.id, description: "QA x", amount: 5 }] }, coachCookies)).status()).toBe(400);

    const res = await apiPost(request, "/api/v1/billing/charges", {
      centerId: center.id,
      parentId: parent.id,
      date: "2026-09-22",
      rows: [
        { childId: child.id, description: "QA Extra Clothing", amount: "5.00" },
        { childId: child.id, description: "QA Field Trip Fee", amount: 15 },
      ],
    }, coachCookies);
    expect(res.status(), await res.text()).toBe(201);

    const fees = await (await apiGet(request, `/api/v1/billing/charges?centerId=${center.id}`, coachCookies)).json();
    expect(fees.map((f) => [f.description, f.amountCents, f.parent.name])).toEqual(expect.arrayContaining([["QA Extra Clothing", 500, parent.name]]));
    const notification = await prisma.notification.findFirst({ where: { recipientId: parent.id, title: "New charge on your account", body: { contains: "QA Extra Clothing" } } });
    expect(notification?.link).toBe("/parent/billing");

    const parentCookies = await loginAsParent(request);
    const ledger = await (await apiGet(request, "/api/v1/billing/ledger", parentCookies)).json();
    const statement = ledger.statements.find((s) => s.dueDate === "2026-09-15" && s.amountCents === 2000);
    expect(statement).toMatchObject({ appliesTo: ["Jacob Anders"], status: "Open" });
    invoiceId = statement.invoiceId;
    const invoice = await (await apiGet(request, `/api/v1/billing/invoices/${invoiceId}`, parentCookies)).json();
    expect(invoice).toMatchObject({ totalCents: 2000, balanceCents: 2000, status: "OVERDUE", invoiceDate: "2026-09-01" });
    expect(invoice.billTo).toMatchObject({ address: "1234 Maple Drive", phone: "801-555-1234" });
    expect((await apiGet(request, `/api/v1/billing/invoices/${invoiceId}`, await loginAsTeacher(request))).status()).toBe(403);
  });

  test("admins see the balance, verify and record a payment; coaches can't", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const list = await (await apiGet(request, `/api/v1/billing/invoices?centerId=${center.id}&month=2026-09`, admin)).json();
    const row = list.parents.find((p) => p.parent.id === parent.id);
    expect(row).toMatchObject({ balanceCents: 2000, status: "OVERDUE", clients: ["Jacob"] });
    expect(list.tiles).toMatchObject({ totalClients: 1, overdue: 1 });

    const coachCookies = await loginAsCoach(request);
    expect((await apiPost(request, `/api/v1/billing/invoices/${invoiceId}/payments`, { amount: 20 }, coachCookies)).status()).toBe(403);
    expect((await apiPut(request, `/api/v1/billing/invoices/${invoiceId}`, { verified: true }, coachCookies)).status()).toBe(403);

    const paid = await apiPost(request, `/api/v1/billing/invoices/${invoiceId}/payments`, { amount: "20.00", method: "Check" }, admin);
    expect(paid.status(), await paid.text()).toBe(200);
    expect(await paid.json()).toMatchObject({ balanceCents: 0, status: "PAID" });
    const verified = await (await apiPut(request, `/api/v1/billing/invoices/${invoiceId}`, { verified: true }, admin)).json();
    expect(verified.verified).toBe(true);

    const ledger = await (await apiGet(request, "/api/v1/billing/ledger", await loginAsParent(request))).json();
    expect(ledger.statements.find((s) => s.invoiceId === invoiceId).status).toBe("Paid");
    expect(ledger.payments.find((p) => p.invoiceId === invoiceId).amountCents).toBe(2000);
  });
});
