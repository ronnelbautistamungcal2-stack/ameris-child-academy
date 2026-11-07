// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, loginAsParent } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return keyOf(d);
};

// Phase 7b Compliance Alerts (mockups 37-01/02) and Form Renewals with the
// parent's e-signature (36-01..03), on a throwaway center.
test.describe("Compliance requirements and form renewals (Phase 7b) @api", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let parent;
  let child;
  let template;
  const requirementIds = [];

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Compliance 7b ${Date.now()}` }, admin)).json();
    parent = await prisma.user.findUnique({ where: { email: "parent@demo.com" } });
    child = await prisma.child.create({ data: { firstName: "Renewal", lastName: "Kid", centerId: center.id, parentId: parent.id } });
  });

  test.afterAll(async ({ request }) => {
    await prisma.complianceRequirement.deleteMany({ where: { id: { in: requirementIds } } });
    if (template?.id) {
      await prisma.formRenewalNote.deleteMany({ where: { templateId: template.id } });
      await prisma.formSubmission.deleteMany({ where: { templateId: template.id } });
      await prisma.formTemplate.delete({ where: { id: template.id } }).catch(() => {});
    }
    if (child) await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("only admins manage requirements, and bad input is refused", async ({ request }) => {
    const coach = await loginAsCoach(request);
    expect((await apiGet(request, "/api/v1/compliance/requirements", coach)).status()).toBe(403);
    const admin = await loginAsAdmin(request);
    const bad = await apiPost(request, "/api/v1/compliance/requirements", { name: "", category: "Safety", frequency: "MONTHLY", nextDue: addDays(3) }, admin);
    expect(bad.status()).toBe(400);
    const badDate = await apiPost(request, "/api/v1/compliance/requirements", { name: "X", category: "Safety", frequency: "MONTHLY", nextDue: "soon" }, admin);
    expect(badDate.status()).toBe(400);
  });

  test("the Next Due Date is optional; checking off starts the cycle from that day", async ({ request }) => {
    // Client sheet 2026-11-07: "Make so the field Next Due Date is not required".
    const admin = await loginAsAdmin(request);
    const res = await apiPost(request, "/api/v1/compliance/requirements", { centerId: center.id, name: "QA No Date", category: "Safety", frequency: "MONTHLY" }, admin);
    expect(res.status(), await res.text()).toBe(201);
    const row = await res.json();
    // Its own rows, removed here so the later tests' counts aren't affected.
    const ids = [row.id];
    try {
      expect(row).toMatchObject({ nextDue: "", status: "UPCOMING" });
      const done = await (await apiPut(request, `/api/v1/compliance/requirements/${row.id}`, { action: "complete" }, admin)).json();
      if (done.next?.id) ids.push(done.next.id);
      expect(done.requirement.status).toBe("COMPLETED");
      expect(done.next.nextDue > addDays(20)).toBe(true);
    } finally {
      await prisma.complianceRequirement.deleteMany({ where: { id: { in: ids } } });
    }
  });

  test("status follows the due date, and checking off adds a row for the next repeat", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const make = async (body) => {
      const res = await apiPost(request, "/api/v1/compliance/requirements", { centerId: center.id, category: "Safety", ...body }, admin);
      expect(res.status(), await res.text()).toBe(201);
      const row = await res.json();
      requirementIds.push(row.id);
      return row;
    };
    const overdue = await make({ name: "QA Fire Drill Documentation", frequency: "MONTHLY", nextDue: addDays(-2), notes: "Upload fire drill log." });
    const soon = await make({ name: "QA Playground Inspection", frequency: "MONTHLY", nextDue: addDays(10) });
    const later = await make({ name: "QA Building Safety Inspection", frequency: "ANNUALLY", nextDue: addDays(120), appliesToRoles: ["COACH"], ageGroups: ["0-1"] });
    const once = await make({ name: "QA Emergency Plan Signed", category: "Policy", frequency: "ONCE", nextDue: addDays(5) });
    expect([overdue.status, soon.status, later.status, once.status]).toEqual(["OVERDUE", "DUE_SOON", "UPCOMING", "DUE_SOON"]);
    expect(later.appliesToRoles).toEqual(["COACH"]);

    // The checked-off row stays, completed, with its own due date; a new row
    // is due the same day next month (or that month's last day).
    const { requirement: done, next } = await (await apiPut(request, `/api/v1/compliance/requirements/${soon.id}`, { action: "complete" }, admin)).json();
    requirementIds.push(next.id);
    const expected = new Date(`${soon.nextDue}T00:00:00Z`);
    const day = expected.getUTCDate();
    expected.setUTCDate(1);
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(expected.getUTCFullYear(), expected.getUTCMonth() + 1, 0)).getUTCDate();
    expected.setUTCDate(Math.min(day, lastDay));
    expect(done.nextDue).toBe(soon.nextDue);
    expect(done.status).toBe("COMPLETED");
    expect(next.nextDue).toBe(expected.toISOString().slice(0, 10));
    expect(next.status).not.toBe("COMPLETED");
    expect(next.name).toBe(soon.name);
    expect(await prisma.complianceCompletion.count({ where: { requirementId: soon.id } })).toBe(1);

    // Undo reopens the row and drops the row it added.
    const undone = await (await apiPut(request, `/api/v1/compliance/requirements/${soon.id}`, { action: "undo" }, admin)).json();
    expect(undone.removedId).toBe(next.id);
    expect(undone.requirement.nextDue).toBe(soon.nextDue);
    expect(undone.requirement.status).toBe("DUE_SOON");
    expect(await prisma.complianceRequirement.count({ where: { id: next.id } })).toBe(0);

    // A requirement that doesn't repeat stays done, keeps its date and adds no row.
    const onceDone = await (await apiPut(request, `/api/v1/compliance/requirements/${once.id}`, { action: "complete" }, admin)).json();
    expect(onceDone.requirement.status).toBe("COMPLETED");
    expect(onceDone.requirement.nextDue).toBe(once.nextDue);
    expect(onceDone.next).toBeNull();

    // Editing keeps fields that are not sent.
    const edited = await (await apiPut(request, `/api/v1/compliance/requirements/${overdue.id}`, { name: "QA Fire Drill Log", repeatOn: 15 }, admin)).json();
    expect(edited.name).toBe("QA Fire Drill Log");
    expect(edited.notes).toBe("Upload fire drill log.");
    expect(edited.repeatOn).toBe(15);

    const list = await (await apiGet(request, `/api/v1/compliance/requirements?centerId=${center.id}`, admin)).json();
    expect(list.filter((r) => requirementIds.includes(r.id))).toHaveLength(4);
    expect((await apiDelete(request, `/api/v1/compliance/requirements/${later.id}`, admin)).status()).toBe(204);
  });

  test("a renewing form shows on the tracker until the parent signs it", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const created = await apiPost(request, "/api/v1/forms/templates", {
      title: `QA Immunization Record ${Date.now()}`, targetRole: "PARENT", assignmentType: "CHILD", active: true, requiresRenewal: true, renewalPeriodDays: 365, centerId: center.id,
    }, admin);
    expect(created.status(), await created.text()).toBe(201);
    template = await created.json();

    const tracker = async () => (await (await apiGet(request, `/api/v1/forms/renewals/tracker?centerId=${center.id}`, admin)).json()).rows.find((r) => r.templateId === template.id && r.childId === child.id);
    const before = await tracker();
    expect(before).toMatchObject({ status: "OVERDUE", submitted: false, child: "Renewal Kid" });

    expect((await apiPut(request, "/api/v1/forms/renewals/tracker", { templateId: template.id, childId: child.id, note: "Reminder sent" }, admin)).status()).toBe(200);
    expect((await tracker()).note).toBe("Reminder sent");

    const parentCookies = await loginAsParent(request);
    const unsigned = await apiPost(request, "/api/v1/forms/submissions", { templateId: template.id, childId: child.id, data: {} }, parentCookies);
    expect(unsigned.status()).toBe(400);
    const signed = await apiPost(request, "/api/v1/forms/submissions", {
      templateId: template.id, childId: child.id, data: {}, certification: { agreed: true, signedName: "Sarah Parent" },
    }, parentCookies);
    expect(signed.status(), await signed.text()).toBe(201);

    const after = await tracker();
    expect(after).toMatchObject({ status: "CURRENT", submitted: true, signedBy: "Sarah Parent" });
    expect(after.daysUntilDue).toBeGreaterThan(360);

    const view = await (await apiGet(request, `/api/v1/forms/submissions/${after.submissionId}`, admin)).json();
    expect(view.data.certification.signedName).toBe("Sarah Parent");
    expect((await apiGet(request, `/api/v1/forms/submissions/${after.submissionId}`, await loginAsCoach(request))).status()).toBe(403);
  });
});
