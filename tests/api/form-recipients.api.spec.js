// @ts-check
// Forms sent to chosen parents or children, for each child or the whole
// family (client sheet 10-29 (12), row 19).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();

test.describe("Form recipients @api", () => {
  const templateIds = [];
  let kid = null; // the demo parent's child
  let sibling = null; // a second child of the demo parent, made for the test

  test.beforeAll(async () => {
    const parent = await prisma.user.findUnique({ where: { email: "parent@demo.com" } });
    kid = await prisma.child.findFirst({ where: { OR: [{ parentId: parent.id }, { guardians: { some: { guardianId: parent.id } } }] } });
    sibling = await prisma.child.create({ data: { firstName: "Sib", lastName: `Form${stamp}`, centerId: kid.centerId, parentId: parent.id } });
  });

  test.afterAll(async () => {
    await prisma.formRenewalNote.deleteMany({ where: { templateId: { in: templateIds } } });
    await prisma.formSubmission.deleteMany({ where: { templateId: { in: templateIds } } });
    await prisma.formTemplate.deleteMany({ where: { id: { in: templateIds } } });
    if (sibling) await prisma.child.delete({ where: { id: sibling.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  async function addForm(request, admin, body) {
    const res = await apiPost(request, "/api/v1/forms/templates", { targetRole: "PARENT", active: true, requiresRenewal: true, renewalPeriodDays: 365, centerId: kid.centerId, ...body }, admin);
    expect(res.status(), await res.text()).toBe(201);
    const t = await res.json();
    templateIds.push(t.id);
    return t;
  }

  test("a child form goes only to the chosen child; family forms only to chosen families", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const toKid = await addForm(request, admin, { title: `QA Kid Form ${stamp}`, assignmentType: "CHILD", recipients: { childIds: [kid.id] } });
    const toOthers = await addForm(request, admin, { title: `QA Other Family ${stamp}`, assignmentType: "FAMILY", recipients: { childIds: ["not-this-family"] } });
    const toAll = await addForm(request, admin, { title: `QA All Families ${stamp}`, assignmentType: "FAMILY", recipients: null });
    expect(toKid.recipients).toEqual({ parentIds: [], childIds: [kid.id] });
    expect(toAll.recipients).toBeNull();

    const parent = await loginAsParent(request);
    const list = await (await apiGet(request, `/api/v1/forms/templates?centerId=${kid.centerId}`, parent)).json();
    const byId = Object.fromEntries(list.map((t) => [t.id, t]));
    expect(byId[toKid.id]?.forChildIds).toEqual([kid.id]); // not the sibling
    expect(byId[toOthers.id]).toBeUndefined();
    expect(byId[toAll.id]).toBeTruthy();

    // The admin tracker: the child form for the chosen child only, and one row
    // for the whole family on the family form.
    const tracker = await (await apiGet(request, `/api/v1/forms/renewals/tracker?centerId=${kid.centerId}`, admin)).json();
    const rows = (id) => tracker.rows.filter((r) => r.templateId === id);
    expect(rows(toKid.id).map((r) => r.childId)).toEqual([kid.id]);
    expect(rows(toOthers.id)).toHaveLength(0);
    // Children sharing a parent account are one family (demo data links more
    // children to the demo parent), so exactly one row names both.
    const family = rows(toAll.id).filter((r) => r.child.includes("Sib") || r.child.includes(kid.firstName));
    expect(family).toHaveLength(1);
    expect(family[0].child).toMatch(/^Family: /);
    expect(family[0].child).toContain("Sib");
    expect(family[0].child).toContain(kid.firstName);
  });
});
