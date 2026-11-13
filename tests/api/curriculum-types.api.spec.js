// @ts-check
// Curriculum types on Curriculum > Categories > Types (client sheet 10-29 (8),
// rows 8-10): the Ameris curriculum admins add, rename and remove them, and
// the list feeds the lesson forms, the Lesson Planner's Type, Sales & Leads,
// the public quote form and Global admin > Subscribers.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie, loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPatch, apiPost } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
const password = crypto.randomBytes(9).toString("base64url");
const globalEmail = `types-global-${stamp}@types-test.local`;
const subEmail = `types-sub-${stamp}@types-test.local`;

test.describe.configure({ mode: "serial" });

test.describe("Curriculum types list @api", () => {
  const userIds = [];
  let account = null;
  let subCenterId = "";
  let lessonId = "";
  let source = null;
  let value = "";
  const label = `QA Montessori ${stamp}`;
  const renamed = `QA Montessori Plus ${stamp}`;
  const leadIds = [];

  async function makeUser(email, data) {
    const user = await prisma.user.create({ data: { email, name: email.split("@")[0], password: await bcrypt.hash(password, 10), ...data } });
    userIds.push(user.id);
    return user;
  }

  test.beforeAll(async () => {
    source = await prisma.center.findFirst({ where: { curriculumSource: true } });
    account = await prisma.subscriberAccount.create({
      data: { accountNumber: `T-${stamp}`, name: `Types Sub ${stamp}`, status: "ACTIVE", addOns: ["CURRICULUM"] },
    });
    subCenterId = (await prisma.center.create({ data: { name: `Types Sub Center ${stamp}`, subscriberAccountId: account.id } })).id;
    const admin = await makeUser(subEmail, { role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: account.id });
    await prisma.centerUser.create({ data: { userId: admin.id, centerId: subCenterId, role: "ADMIN" } });
    await makeUser(globalEmail, { role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] });
  });

  test.afterAll(async () => {
    if (lessonId) await prisma.lesson.deleteMany({ where: { id: lessonId } });
    if (leadIds.length) {
      await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
      await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    }
    await prisma.centerUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (subCenterId) await prisma.center.deleteMany({ where: { id: subCenterId } });
    if (account) {
      await prisma.subscriberAccountNote.deleteMany({ where: { accountId: account.id } });
      await prisma.subscriberAccount.deleteMany({ where: { id: account.id } });
    }
    await prisma.curriculumType.deleteMany({ where: { label: { contains: String(stamp) } } });
    await prisma.$disconnect();
  });

  test("everyone signed in reads the list; only Ameris curriculum admins may change it", async ({ request }) => {
    const admin = await loginAsAdmin(request); // an admin of the curriculum center (Demo Center)
    const list = await (await apiGet(request, "/api/v1/curriculum-types", admin)).json();
    expect(list.canEdit).toBe(true);
    expect(list.types.map((t) => t.value)).toEqual(expect.arrayContaining(["NON_DENOMINATIONAL", "NON_DENOMINATIONAL_CHRISTIAN", "OTHER"]));

    const global = await getAuthCookie(request, globalEmail, password);
    expect((await (await apiGet(request, "/api/v1/curriculum-types", global)).json()).canEdit).toBe(true);

    const sub = await getAuthCookie(request, subEmail, password);
    const subList = await (await apiGet(request, "/api/v1/curriculum-types", sub)).json();
    expect(subList.canEdit).toBe(false);
    expect(subList.types.length).toBe(list.types.length);
    expect((await apiPost(request, "/api/v1/curriculum-types", { label }, sub)).status()).toBe(403);

    const teacher = await loginAsTeacher(request);
    expect((await apiPost(request, "/api/v1/curriculum-types", { label }, teacher)).status()).toBe(403);
  });

  test("a curriculum admin adds and renames a type", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const created = await apiPost(request, "/api/v1/curriculum-types", { label }, admin);
    expect(created.status()).toBe(201);
    value = (await created.json()).value;
    expect(value).toMatch(/^QA_MONTESSORI_/);
    // Names are unique, ignoring case.
    expect((await apiPost(request, "/api/v1/curriculum-types", { label: label.toUpperCase() }, admin)).status()).toBe(409);
    expect((await apiPost(request, "/api/v1/curriculum-types", { label: "  " }, admin)).status()).toBe(400);

    const patched = await apiPatch(request, `/api/v1/curriculum-types?value=${value}`, { label: renamed }, admin);
    expect(patched.status()).toBe(200);
    expect(await patched.json()).toEqual({ value, label: renamed });
  });

  test("the new type shows up wherever types are chosen", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    // Lesson Planner Type.
    const plans = await (await apiGet(request, `/api/v1/curriculum-plans?centerId=${source.id}`, admin)).json();
    expect(plans.types).toContainEqual({ value, label: renamed });
    // Public Request a Quote form.
    const options = await (await request.get("/api/v1/solutions/options")).json();
    expect(options.curriculumTypes).toContainEqual({ value, label: renamed });

    // A step can be given the type.
    const step = await apiPost(request, "/api/v1/lessons", { centerId: source.id, title: `QA typed step ${stamp}`, isStep: true, types: [value] }, admin);
    expect(step.status()).toBeLessThan(300);
    lessonId = (await step.json()).id;
    expect((await prisma.lesson.findUnique({ where: { id: lessonId } }))?.types).toEqual([value]);

    // Global admin > Subscribers > Edit Subscription.
    const global = await getAuthCookie(request, globalEmail, password);
    const saved = await apiPatch(request, `/api/v1/global/subscribers/${account.id}`, { curriculumTypes: [value] }, global);
    expect(saved.status()).toBe(200);
    expect((await prisma.subscriberAccount.findUnique({ where: { id: account.id } }))?.curriculumTypes).toEqual([value]);
  });

  test("Sales & Leads saves the chosen type; its price is Standard unless it is the Christian type", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const make = async (curriculumType) => {
      const res = await apiPost(
        request,
        "/api/v1/global/leads",
        {
          centerName: `QA Types Lead ${stamp}`,
          contactName: "QA Types",
          email: `types-lead-${stamp}@types-test.local`,
          addOns: ["CURRICULUM"],
          pricingSelection: { children: 20, programType: "CENTER", curriculumType },
        },
        global,
      );
      expect(res.status()).toBe(201);
      const lead = await res.json();
      leadIds.push(lead.id);
      return (await prisma.lead.findUnique({ where: { id: lead.id } }))?.pricingSelection;
    };
    expect(await make(value)).toMatchObject({ curriculumType: value, curriculumVersion: "STANDARD" });
    expect(await make("NON_DENOMINATIONAL_CHRISTIAN")).toMatchObject({ curriculumType: "NON_DENOMINATIONAL_CHRISTIAN", curriculumVersion: "FAITH_BASED" });
  });

  test("a type in use, or one the prices use, can't be removed", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const priced = await apiDelete(request, "/api/v1/curriculum-types?value=NON_DENOMINATIONAL_CHRISTIAN", admin);
    expect(priced.status()).toBe(409);

    const inUse = await apiDelete(request, `/api/v1/curriculum-types?value=${value}`, admin);
    expect(inUse.status()).toBe(409);
    expect((await inUse.json()).error).toContain("1 lesson or step");

    await prisma.lesson.update({ where: { id: lessonId }, data: { types: [] } });
    await prisma.subscriberAccount.update({ where: { id: account.id }, data: { curriculumTypes: [] } });
    expect((await apiDelete(request, `/api/v1/curriculum-types?value=${value}`, admin)).status()).toBe(204);
    const after = await (await apiGet(request, "/api/v1/curriculum-types", admin)).json();
    expect(after.types.map((t) => t.value)).not.toContain(value);
  });
});
