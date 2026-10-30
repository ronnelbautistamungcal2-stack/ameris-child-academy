// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, loginAsHrStaff, loginAsParent, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
const earlierToday = () => {
  const d = new Date(Date.now() - 60 * 1000);
  return d.toISOString();
};

// Phase 7c: Character Guide decision trees, the Daily Log's Course
// Correction / IPP entries, and Parent Involvement events (client sheets 16,
// 35, 40) on a throwaway center.
test.describe("Phase 7c: Character Guide, Daily Log IPP, Parent Involvement @api", () => {
  test.describe.configure({ mode: "serial" });
  const stamp = Date.now();
  let center;
  let otherCenter;
  let parent;
  let child;
  let category;
  let behavior;
  let plan;
  let event;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA 7c ${stamp}` }, admin)).json();
    otherCenter = await (await apiPost(request, "/api/v1/centers", { name: `QA 7c other ${stamp}` }, admin)).json();
    const [coach, hr] = await Promise.all(["coach@demo.com", "hr@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })));
    parent = await prisma.user.findUnique({ where: { email: "parent@demo.com" } });
    await prisma.centerUser.create({ data: { userId: coach.id, centerId: center.id, role: "COACH" } });
    if (hr) await prisma.centerUser.create({ data: { userId: hr.id, centerId: center.id, role: "HR_STAFF" } });
    child = await prisma.child.create({ data: { firstName: "Guide", lastName: `Kid${stamp}`, birthDate: new Date("2023-01-10T00:00:00Z"), centerId: center.id, parentId: parent.id } });
    plan = await prisma.behaviorPlan.create({
      data: {
        childId: child.id,
        centerId: center.id,
        title: "QA Progress Plan",
        focusArea: "Self-Regulation",
        status: "ACTIVE",
        startDate: new Date(),
        createdById: (await prisma.user.findUnique({ where: { email: "admin@demo.com" } })).id,
        goals: { create: [{ domain: "Social", title: "Use words when upset", ippStrategies: { create: [{ kind: "STRATEGY", text: "Calm-down corner" }] } }] },
      },
      include: { goals: true },
    });
  });

  test.afterAll(async ({ request }) => {
    if (behavior?.id) await prisma.characterBehavior.deleteMany({ where: { name: { startsWith: `QA Behavior ${stamp}` } } });
    await prisma.characterCategory.deleteMany({ where: { name: { startsWith: `QA Category ${stamp}` } } });
    await prisma.notification.deleteMany({ where: { title: "IPP Requested", body: { contains: `Kid${stamp}` } } });
    if (child) {
      await prisma.activityLog.deleteMany({ where: { childId: child.id } });
      await prisma.parentInvolvement.deleteMany({ where: { activity: { centerId: center.id } } });
    }
    if (plan) await prisma.behaviorPlan.delete({ where: { id: plan.id } }).catch(() => {});
    await prisma.parentInvolvementActivity.deleteMany({ where: { centerId: { in: [center?.id, otherCenter?.id].filter(Boolean) } } });
    if (child) await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
    const admin = await loginAsAdmin(request);
    for (const c of [center, otherCenter]) if (c?.id) await apiDelete(request, `/api/v1/centers/${c.id}`, admin);
    await prisma.$disconnect();
  });

  test("admins build decision trees; staff read them", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    // The client's mockup content is seeded.
    const seeded = await (await apiGet(request, "/api/v1/character-guide/behaviors?type=COURSE_CORRECTION", await loginAsTeacher(request))).json();
    expect(seeded.some((b) => b.name === "Child Hits Another Child" && b.tree.branches.length === 4)).toBeTruthy();
    expect((await apiGet(request, "/api/v1/character-guide/behaviors", await loginAsParent(request))).status()).toBe(403);
    expect((await apiPost(request, "/api/v1/character-guide/categories", { name: "Nope" }, await loginAsTeacher(request))).status()).toBe(403);

    const made = await apiPost(request, "/api/v1/character-guide/categories", { name: `QA Category ${stamp}`, description: "Testing" }, admin);
    expect(made.status(), await made.text()).toBe(201);
    category = await made.json();
    expect((await apiPost(request, "/api/v1/character-guide/categories", { name: `qa category ${stamp}` }, admin)).status()).toBe(409);

    const tree = {
      intro: "Stay calm.",
      question: { title: "Step 1: Determine the Reason", prompt: "Why?" },
      branches: [
        { id: "b1", title: "Frustration", prompt: "Unable to express a need?", offenses: [{ id: "o1", steps: ["Name the feeling.", ""] }, { id: "o2", steps: ["Separate the children.", "Loss of preferred item (5 minutes)."] }] },
        { id: "b2", title: "", prompt: "dropped: no title", offenses: [] },
      ],
    };
    const noOffense = await apiPost(request, "/api/v1/character-guide/behaviors", { type: "COURSE_CORRECTION", name: `QA Behavior ${stamp}`, categoryId: category.id, level: 3, description: "d", tree: { ...tree, branches: [{ id: "x", title: "Reason", offenses: [] }] } }, admin);
    expect(noOffense.status()).toBe(400);
    const res = await apiPost(request, "/api/v1/character-guide/behaviors", { type: "COURSE_CORRECTION", name: `QA Behavior ${stamp}`, categoryId: category.id, level: 3, description: "Child pushes", tree }, admin);
    expect(res.status(), await res.text()).toBe(201);
    behavior = await res.json();
    expect(behavior.tree.branches).toHaveLength(1);
    expect(behavior.tree.branches[0].offenses[0].steps).toEqual(["Name the feeling."]);
    expect(behavior.category.name).toBe(`QA Category ${stamp}`);

    const edited = await apiPut(request, `/api/v1/character-guide/behaviors/${behavior.id}`, { ...behavior, description: "Child pushes a friend" }, admin);
    expect((await edited.json()).description).toBe("Child pushes a friend");
    // A category in use cannot be deleted.
    expect((await apiDelete(request, `/api/v1/character-guide/categories/${category.id}`, admin)).status()).toBe(409);
  });

  test("Course Correction entries follow the guide; IPP requests notify and IPP logs reach the plan", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const correction = await apiPost(request, "/api/v1/activities", {
      childId: child.id,
      type: "BEHAVIOR",
      notes: "Pushed at the slide",
      createdAt: earlierToday(),
      details: { behaviorType: category.name, categoryId: category.id, behaviorId: behavior.id, behaviorName: behavior.name, behaviorLevel: "3", branchId: "b1", branchTitle: "Frustration", offense: 2, steps: ["Separate the children."], location: "Playground" },
    }, admin);
    expect(correction.status(), await correction.text()).toBe(201);

    // Reports name the guide behavior.
    const student = await (await apiGet(request, `/api/v1/reports/student/${child.id}`, admin)).json();
    expect(student.courseCorrections?.[0]?.label).toBe(behavior.name);

    const badRequest = await apiPost(request, "/api/v1/activities", { childId: child.id, type: "IPP", createdAt: earlierToday(), details: { kind: "REQUEST", primaryConcern: "" } }, admin);
    expect(badRequest.status()).toBe(400);
    const coach = await loginAsCoach(request);
    const requested = await apiPost(request, "/api/v1/activities", {
      childId: child.id,
      type: "IPP",
      createdAt: earlierToday(),
      details: { kind: "REQUEST", primaryConcern: "Hits when upset", areaOfConcern: "Behavior", previousSupports: "Visual cues", strengths: "Kind" },
    }, coach);
    expect(requested.status(), await requested.text()).toBe(201);
    const adminUser = await prisma.user.findUnique({ where: { email: "admin@demo.com" } });
    expect(await prisma.notification.count({ where: { recipientId: adminUser.id, title: "IPP Requested", body: { contains: `Kid${stamp}` } } })).toBe(1);

    const goal = plan.goals[0];
    const logged = await apiPost(request, "/api/v1/activities", {
      childId: child.id,
      type: "IPP",
      createdAt: earlierToday(),
      details: { kind: "LOG", planId: plan.id, goalId: goal.id, goalTitle: goal.title, tactic: "Calm-down corner", observation: "Calmed in 2 minutes", time: "10:15" },
    }, admin);
    expect(logged.status(), await logged.text()).toBe(201);
    const planLogs = await prisma.behaviorPlanLog.findMany({ where: { planId: plan.id } });
    expect(planLogs).toHaveLength(1);
    expect(planLogs[0]).toMatchObject({ goalId: goal.id, tactic: "Calm-down corner", observation: "Calmed in 2 minutes" });

    // Coaches log only at their centers.
    const elsewhere = await prisma.child.create({ data: { firstName: "Else", lastName: `Where${stamp}`, centerId: otherCenter.id } });
    try {
      expect((await apiPost(request, "/api/v1/activities", { childId: elsewhere.id, type: "ACTIVITY", createdAt: earlierToday() }, coach)).status()).toBe(403);
    } finally {
      await prisma.child.delete({ where: { id: elsewhere.id } });
    }
  });

  test("events: staff create them, parents sign up for a role and sign their logged hours", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const base = { description: "Games and food", date: inDays(5), startTime: "16:00", endTime: "17:30", location: "Playground", audience: ["ALL"], roles: [{ name: "Setup", description: "Tables", needed: 1 }, { name: "Cleanup", needed: 2 }] };
    expect((await apiPost(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, { ...base, title: "" }, admin)).status()).toBe(400);
    expect((await apiPost(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, { ...base, title: "x", roles: [] }, admin)).status()).toBe(400);
    const made = await apiPost(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, { ...base, title: `QA Family Picnic ${stamp}` }, admin);
    expect(made.status(), await made.text()).toBe(201);
    event = await made.json();
    expect(event.capacity).toBe(3);
    await apiPost(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, { ...base, title: `QA Planning ${stamp}`, status: "PLANNING" }, admin);
    // An event for infants only: Guide Kid is a toddler, so the parent does not see it.
    await apiPost(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, { ...base, title: `QA Infant Event ${stamp}`, audience: ["INFANT"] }, admin);

    const hr = await loginAsHrStaff(request);
    const hrList = await apiGet(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, hr);
    expect(hrList.status()).toBe(200);
    expect((await hrList.json()).map((e) => e.title)).toContain(`QA Planning ${stamp}`);

    const parentCookies = await loginAsParent(request);
    const visible = await (await apiGet(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, parentCookies)).json();
    expect(visible.map((e) => e.title)).toEqual([`QA Family Picnic ${stamp}`]);
    expect(visible[0]).toMatchObject({ signedUpCount: 0, volunteersNeeded: 3 });

    const signup = { kind: "SIGNUP", activityId: event.id, childIds: [child.id], date: base.date, startTime: "16:00", endTime: "17:30" };
    expect((await apiPost(request, "/api/v1/parent-involvement", signup, parentCookies)).status()).toBe(400);
    const setupRole = visible[0].roles.find((r) => r.name === "Setup");
    const signed = await apiPost(request, "/api/v1/parent-involvement", { ...signup, roleId: setupRole.id }, parentCookies);
    expect(signed.status(), await signed.text()).toBe(201);
    expect((await signed.json()).roleName).toBe("Setup");
    const after = await (await apiGet(request, `/api/v1/parent-involvement/activities?centerId=${center.id}`, parentCookies)).json();
    expect(after[0]).toMatchObject({ signedUpCount: 1, signedUp: true });
    expect(after[0].roles.find((r) => r.name === "Setup").filled).toBe(1);

    const log = { kind: "LOG", activityId: event.id, childIds: [child.id], date: inDays(-1), startTime: "09:00", endTime: "11:00", notes: "Helped set up" };
    expect((await apiPost(request, "/api/v1/parent-involvement", log, parentCookies)).status()).toBe(400);
    const logged = await apiPost(request, "/api/v1/parent-involvement", { ...log, signature: { agreed: true, signedName: "Pat Parent" } }, parentCookies);
    expect(logged.status(), await logged.text()).toBe(201);

    // Volunteer Tracking: logged time with the e-signature, plus a staff-entered row.
    const added = await apiPost(request, "/api/v1/parent-involvement", { activityId: event.id, parentId: parent.id, childIds: [child.id], date: inDays(-2), hours: 1.5, notes: "Phone-in" }, admin);
    expect(added.status(), await added.text()).toBe(201);
    const tracking = await (await apiGet(request, `/api/v1/parent-involvement?centerId=${center.id}&kind=LOG`, admin)).json();
    expect(tracking).toHaveLength(2);
    expect(tracking.find((r) => r.notes === "Helped set up").signature).toMatchObject({ signedName: "Pat Parent" });
    expect(tracking.find((r) => r.notes === "Phone-in")).toMatchObject({ hours: 1.5, signature: null });

    // Clicking an event edits it.
    const edited = await apiPut(request, `/api/v1/parent-involvement/activities/${event.id}`, { ...base, title: `QA Family Picnic ${stamp}`, location: "Main Room" }, admin);
    expect((await edited.json()).location).toBe("Main Room");
    expect((await apiPut(request, `/api/v1/parent-involvement/activities/${event.id}`, base, parentCookies)).status()).toBe(403);
  });
});
