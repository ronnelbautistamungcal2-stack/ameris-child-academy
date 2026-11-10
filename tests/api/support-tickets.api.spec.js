// @ts-check
// Customer Support (client 2026-11-07, step F): subscribers open tickets,
// Ameris replies and asks for center access, the subscriber grants it, and
// access lasts until someone clicks End Access (closing the ticket doesn't end it).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiGet, apiPost, apiPatch } = require("../helpers/api");
const { demoAccountId } = require("../helpers/accounts");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only people and account, created here and removed in afterAll.
const globalEmail = `support-global-${stamp}@support-test.local`;
const supportAdminEmail = `support-ameris-admin-${stamp}@support-test.local`;
const subEmail = `support-sub-${stamp}@support-test.local`;
const otherSubEmail = `support-other-${stamp}@support-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

test.describe.configure({ mode: "serial" });

test.describe("Customer Support tickets @api", () => {
  const userIds = [];
  const accountIds = [];
  const centerIds = [];
  let subCenterId = "";
  let ticketId = "";
  let grantId = "";

  async function makeUser(email, data) {
    const user = await prisma.user.create({ data: { email, name: email.split("@")[0], password: await bcrypt.hash(password, 10), ...data } });
    userIds.push(user.id);
    return user;
  }

  async function makeSubscriber(email, label) {
    const account = await prisma.subscriberAccount.create({
      data: { accountNumber: `S-${label}-${stamp}`, name: `Support ${label} ${stamp}`, status: "ACTIVE" },
    });
    accountIds.push(account.id);
    const center = await prisma.center.create({ data: { name: `Support ${label} Center ${stamp}`, subscriberAccountId: account.id } });
    centerIds.push(center.id);
    const admin = await makeUser(email, { role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: account.id });
    await prisma.centerUser.create({ data: { userId: admin.id, centerId: center.id, role: "ADMIN" } });
    return { account, center };
  }

  test.beforeAll(async () => {
    await makeUser(globalEmail, { role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] });
    // An Ameris staff member who is both a center admin (Ameris Academy) and a global admin.
    await makeUser(supportAdminEmail, { role: "ADMIN", roles: ["ADMIN", "GLOBAL_ADMIN"], subscriberAccountId: await demoAccountId(prisma) });
    subCenterId = (await makeSubscriber(subEmail, "A")).center.id;
    await makeSubscriber(otherSubEmail, "B");
  });

  test.afterAll(async () => {
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.supportTicket.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.centerUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.center.deleteMany({ where: { id: { in: centerIds } } });
    await prisma.subscriberAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.$disconnect();
  });

  test("a subscriber opens a ticket; other subscribers can't see it", async ({ request }) => {
    const sub = await getAuthCookie(request, subEmail, password);
    expect((await apiPost(request, "/api/v1/support/tickets", { subject: "", body: "x" }, sub)).status()).toBe(400);
    const res = await apiPost(request, "/api/v1/support/tickets", { subject: "Report won't load", body: "The class report spins forever.", centerId: subCenterId }, sub);
    expect(res.status(), await res.text()).toBe(201);
    const ticket = await res.json();
    ticketId = ticket.id;
    expect(ticket.number).toMatch(/^T-\d{4,}$/);
    expect(ticket.status).toBe("OPEN");

    const mine = await (await apiGet(request, "/api/v1/support/tickets", sub)).json();
    expect(mine.tickets.map((t) => t.id)).toEqual([ticketId]);

    const other = await getAuthCookie(request, otherSubEmail, password);
    expect((await (await apiGet(request, "/api/v1/support/tickets", other)).json()).tickets).toEqual([]);
    expect((await apiGet(request, `/api/v1/support/tickets/${ticketId}`, other)).status()).toBe(404);

    // Center admins can't use the Ameris queue.
    expect((await apiGet(request, "/api/v1/global/support", sub)).status()).toBe(403);
  });

  test("Ameris sees the ticket, replies, and the reply marks it In Progress", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const list = await (await apiGet(request, `/api/v1/global/support?q=${encodeURIComponent("won't load")}`, global)).json();
    expect(list.tickets.map((t) => t.id)).toContain(ticketId);
    const detail = await (await apiPost(request, `/api/v1/global/support/${ticketId}`, { reply: "Looking into it." }, global)).json();
    expect(detail.status).toBe("IN_PROGRESS");
    expect(detail.messages.map((m) => [m.fromAmeris, m.body])).toEqual([
      [false, "The class report spins forever."],
      [true, "Looking into it."],
    ]);
    expect(detail.accountCenters.map((c) => c.id)).toEqual([subCenterId]);

    // The subscriber's admin was told.
    const sub = await prisma.user.findUnique({ where: { email: subEmail }, select: { id: true } });
    const notes = await prisma.notification.findMany({ where: { recipientId: sub?.id } });
    expect(notes.some((n) => n.link === `/admin/support?ticket=${ticketId}`)).toBe(true);
  });

  test("center access: requested, granted, still on after the ticket closes, ended by End Access", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const sub = await getAuthCookie(request, subEmail, password);
    const ameris = await getAuthCookie(request, supportAdminEmail, password);

    // Before access, the Ameris admin can't open the subscriber's center.
    expect((await apiGet(request, `/api/v1/children?centerId=${subCenterId}`, ameris)).status()).toBe(403);

    const otherCenter = centerIds[1];
    expect((await apiPost(request, `/api/v1/global/support/${ticketId}`, { requestAccess: { centerId: otherCenter } }, global)).status()).toBe(400);
    const requested = await apiPost(request, `/api/v1/global/support/${ticketId}`, { requestAccess: { centerId: subCenterId, reason: "Check the report" } }, global);
    expect(requested.status(), await requested.text()).toBe(201);
    const grant = (await requested.json()).accessGrants[0];
    grantId = grant.id;
    expect(grant.status).toBe("REQUESTED");
    expect((await apiPost(request, `/api/v1/global/support/${ticketId}`, { requestAccess: { centerId: subCenterId } }, global)).status()).toBe(409);

    // Only the subscriber grants; another subscriber can't.
    expect((await apiPost(request, `/api/v1/global/support/access/${grantId}`, { action: "GRANT" }, global)).status()).toBe(403);
    const other = await getAuthCookie(request, otherSubEmail, password);
    expect((await apiPost(request, `/api/v1/support/access/${grantId}`, { action: "GRANT" }, other)).status()).toBe(404);
    const granted = await apiPost(request, `/api/v1/support/access/${grantId}`, { action: "GRANT" }, sub);
    expect(granted.status(), await granted.text()).toBe(200);
    expect((await granted.json()).status).toBe("GRANTED");

    // Now the Ameris admin reaches the center, and it shows in their center list.
    expect((await apiGet(request, `/api/v1/children?centerId=${subCenterId}`, ameris)).status()).toBe(200);
    const centers = await (await apiGet(request, "/api/v1/centers", ameris)).json();
    expect(centers.some((c) => c.id === subCenterId)).toBe(true);

    // Closing the ticket keeps the access.
    const closed = await (await apiPatch(request, `/api/v1/global/support/${ticketId}`, { status: "CLOSED" }, global)).json();
    expect(closed.status).toBe("CLOSED");
    expect((await apiGet(request, `/api/v1/children?centerId=${subCenterId}`, ameris)).status()).toBe(200);

    // End Access (here by the subscriber) takes it away.
    const ended = await apiPost(request, `/api/v1/support/access/${grantId}`, { action: "END" }, sub);
    expect((await ended.json()).status).toBe("ENDED");
    expect((await apiGet(request, `/api/v1/children?centerId=${subCenterId}`, ameris)).status()).toBe(403);
    expect((await apiPost(request, `/api/v1/global/support/access/${grantId}`, { action: "END" }, global)).status()).toBe(409);

    const detail = await (await apiGet(request, `/api/v1/support/tickets/${ticketId}`, sub)).json();
    const events = detail.messages.filter((m) => m.isEvent).map((m) => m.body);
    expect(events).toEqual([
      expect.stringContaining("requested access"),
      expect.stringContaining("granted"),
      "Status changed to Closed.",
      expect.stringContaining("ended"),
    ]);
  });

  test("Ameris can end access itself, and a subscriber reply reopens a closed ticket", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const sub = await getAuthCookie(request, subEmail, password);
    const ameris = await getAuthCookie(request, supportAdminEmail, password);
    const again = await (await apiPost(request, `/api/v1/global/support/${ticketId}`, { requestAccess: { centerId: subCenterId } }, global)).json();
    const live = again.accessGrants.find((g) => g.status === "REQUESTED");
    await apiPost(request, `/api/v1/support/access/${live.id}`, { action: "GRANT" }, sub);
    expect((await apiGet(request, `/api/v1/children?centerId=${subCenterId}`, ameris)).status()).toBe(200);
    const ended = await apiPost(request, `/api/v1/global/support/access/${live.id}`, { action: "END" }, global);
    expect((await ended.json()).status).toBe("ENDED");
    expect((await apiGet(request, `/api/v1/children?centerId=${subCenterId}`, ameris)).status()).toBe(403);

    const reopened = await (await apiPost(request, `/api/v1/support/tickets/${ticketId}`, { reply: "It's back." }, sub)).json();
    expect(reopened.status).toBe("OPEN");
  });

  test("Ameris opens a ticket for a subscriber", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const res = await apiPost(request, "/api/v1/global/support", { accountId: accountIds[1], subject: "Called about billing", body: "Logged from a phone call." }, global);
    expect(res.status(), await res.text()).toBe(201);
    const other = await getAuthCookie(request, otherSubEmail, password);
    const list = await (await apiGet(request, "/api/v1/support/tickets", other)).json();
    expect(list.tickets.map((t) => t.subject)).toEqual(["Called about billing"]);
  });
});
