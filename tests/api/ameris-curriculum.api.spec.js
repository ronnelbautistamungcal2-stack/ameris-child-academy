// @ts-check
// Ameris Solutions curriculum (client 2026-11-07, step E): subscribers follow
// an Ameris age-group planner on their Lesson Calendar and weekly plan, see
// only lessons of their account's types, and are assessed on the Ameris
// Steps of Progression bank. The banks themselves stay with Ameris.
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getAuthCookie } = require("../helpers/auth");
const { apiDelete, apiGet, apiPatch, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();
const stamp = Date.now();
// Test-only people, account and curriculum rows, removed in afterAll.
const globalEmail = `curr-global-${stamp}@curriculum-test.local`;
const subEmail = `curr-sub-${stamp}@curriculum-test.local`;
const teacherEmail = `curr-teacher-${stamp}@curriculum-test.local`;
const password = crypto.randomBytes(9).toString("base64url");

/** The next weekday on or after today, as YYYY-MM-DD (local time, like the API). */
function nextWeekday() {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(key, n) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test.describe.configure({ mode: "serial" });

test.describe("Ameris curriculum for subscribers @api", () => {
  const userIds = [];
  const lessonIds = [];
  let source = null;
  let ageGroup = ""; // an Age Range of the curriculum center (client sheet 10-29, row 3)
  let planId = "";
  let typedPlanId = "";
  let account = null;
  let subCenterId = "";
  let subRoomId = "";
  let childId = "";
  const ids = {};

  async function makeUser(email, data) {
    const user = await prisma.user.create({ data: { email, name: email.split("@")[0], password: await bcrypt.hash(password, 10), ...data } });
    userIds.push(user.id);
    return user;
  }

  async function makeLesson(title, data) {
    const lesson = await prisma.lesson.create({ data: { title, centerId: source.id, ...data } });
    lessonIds.push(lesson.id);
    return lesson;
  }

  test.beforeAll(async () => {
    source = await prisma.center.findFirst({ where: { curriculumSource: true } });
    expect(source, "the dev database needs a curriculum source center").toBeTruthy();
    if (!source) return;

    // An age group (an Age Range on the curriculum center's Categories tab)
    // with a two-day "All types" plan.
    ageGroup = `Age Group ${stamp}`;
    await prisma.curriculumOption.create({ data: { centerId: source.id, kind: "AGE_RANGE", name: ageGroup } });
    ids.nd = (await makeLesson(`ND lesson ${stamp}`, { types: ["NON_DENOMINATIONAL"] })).id;
    ids.ndc = (await makeLesson(`Christian lesson ${stamp}`, { types: ["NON_DENOMINATIONAL_CHRISTIAN"] })).id;
    ids.untyped = (await makeLesson(`Untyped lesson ${stamp}`, {})).id;
    planId = (await prisma.curriculumPlan.create({ data: { centerId: source.id, ageRange: ageGroup, type: "", theme: "Seasons", dayCount: 2 } })).id;
    await prisma.lessonPlanCell.createMany({
      data: [
        { centerId: source.id, planId, day: 1, rowIndex: 0, lessonId: ids.nd, title: `ND lesson ${stamp}` },
        { centerId: source.id, planId, day: 1, rowIndex: 1, lessonId: ids.ndc, title: `Christian lesson ${stamp}` },
        { centerId: source.id, planId, day: 2, rowIndex: 0, lessonId: ids.untyped, title: `Untyped lesson ${stamp}` },
        { centerId: source.id, planId, day: 2, rowIndex: 1, title: "Circle time" },
      ],
    });
    ids.stepNd = (await makeLesson(`ND step ${stamp}`, { isStep: true, types: ["NON_DENOMINATIONAL"] })).id;
    ids.stepNdc = (await makeLesson(`Christian step ${stamp}`, { isStep: true, types: ["NON_DENOMINATIONAL_CHRISTIAN"] })).id;

    // A Standard (Non-Denominational) subscriber with one center and classroom.
    account = await prisma.subscriberAccount.create({
      data: {
        accountNumber: `E-${stamp}`,
        name: `Curriculum Sub ${stamp}`,
        status: "ACTIVE",
        addOns: ["CURRICULUM", "STEPS_OF_PROGRESSION"],
        curriculumTypes: ["NON_DENOMINATIONAL"],
      },
    });
    const center = await prisma.center.create({ data: { name: `Curriculum Sub Center ${stamp}`, subscriberAccountId: account.id } });
    subCenterId = center.id;
    subRoomId = (await prisma.classRoom.create({ data: { name: "Preschool", centerId: center.id } })).id;
    const admin = await makeUser(subEmail, { role: "ADMIN", roles: ["ADMIN"], subscriberAccountId: account.id });
    await prisma.centerUser.create({ data: { userId: admin.id, centerId: center.id, role: "ADMIN" } });
    const teacher = await makeUser(teacherEmail, { role: "TEACHER", roles: ["TEACHER"], subscriberAccountId: account.id });
    await prisma.centerUser.create({ data: { userId: teacher.id, centerId: center.id, role: "TEACHER" } });
    await prisma.teacherClass.create({ data: { teacherId: teacher.id, classId: subRoomId } });
    childId = (await prisma.child.create({ data: { centerId: center.id, classRoomId: subRoomId, firstName: "QA", lastName: `Curriculum ${stamp}` } })).id;

    await makeUser(globalEmail, { role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"] });
  });

  test.afterAll(async () => {
    if (childId) {
      await prisma.progressEntry.deleteMany({ where: { progress: { childId } } });
      await prisma.progress.deleteMany({ where: { childId } });
      await prisma.child.deleteMany({ where: { id: childId } });
    }
    await prisma.teacherClass.deleteMany({ where: { teacherId: { in: userIds } } });
    await prisma.centerUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (subCenterId) {
      await prisma.lessonCalendarAnchor.deleteMany({ where: { centerId: subCenterId } });
      await prisma.lessonClosedDay.deleteMany({ where: { centerId: subCenterId } });
      await prisma.classRoom.deleteMany({ where: { centerId: subCenterId } });
      await prisma.center.deleteMany({ where: { id: subCenterId } });
    }
    if (account) {
      await prisma.subscriberAccountNote.deleteMany({ where: { accountId: account.id } });
      await prisma.subscriberAccount.deleteMany({ where: { id: account.id } });
    }
    if (ageGroup && source) {
      await prisma.curriculumPlan.deleteMany({ where: { centerId: source.id, ageRange: ageGroup } }); // cells and rows go with it
      await prisma.curriculumOption.deleteMany({ where: { centerId: source.id, kind: "AGE_RANGE", name: ageGroup } });
    }
    if (lessonIds.length) await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
    await prisma.$disconnect();
  });

  test("the subscriber account is flagged as on the Ameris curriculum", async ({ request }) => {
    const sub = await getAuthCookie(request, subEmail, password);
    const mine = await (await apiGet(request, "/api/v1/account", sub)).json();
    expect(mine.account.amerisCurriculum).toBe(true);
    const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
    expect((await (await apiGet(request, "/api/v1/account", demo)).json()).account.amerisCurriculum).toBe(false);
    // Only Ameris can see the curriculum settings.
    expect((await apiGet(request, "/api/v1/global/curriculum", sub)).status()).toBe(403);
  });

  test("Global admin gives the account an age group", async ({ request }) => {
    const global = await getAuthCookie(request, globalEmail, password);
    const info = await (await apiGet(request, "/api/v1/global/curriculum", global)).json();
    expect(info.source.id).toBe(source.id);
    expect(info.ageGroups.map((g) => g.id)).toContain(ageGroup);

    const res = await apiPatch(request, `/api/v1/global/subscribers/${account.id}`, { curriculumAgeGroups: [ageGroup, "not-an-age-group"] }, global);
    expect(res.status(), await res.text()).toBe(200);
    const detail = await res.json();
    expect(detail.curriculumAgeGroups).toEqual([ageGroup]);
    expect(detail.ageGroupNames).toEqual([`Age Group ${stamp}`]);
    expect(detail.notes.some((n) => n.description === `Age groups set to Age Group ${stamp}.`)).toBe(true);
  });

  test("the Lesson Calendar shows the age group's lessons of the account's types", async ({ request }) => {
    const sub = await getAuthCookie(request, subEmail, password);
    const start = nextWeekday();
    const put = await apiPut(request, "/api/v1/lesson-calendar", { centerId: subCenterId, classRoomId: subRoomId, startDate: start, dayNumber: 1, closedDays: [] }, sub);
    expect(put.status(), await put.text()).toBe(200);

    const q = new URLSearchParams({ centerId: subCenterId, classRoomId: subRoomId, from: start, to: addDays(start, 6) });
    const cal = await (await apiGet(request, `/api/v1/lesson-calendar?${q}`, sub)).json();
    expect(cal.curriculum.mode).toBe("AMERIS");
    // One age group on the account: the classroom follows it without choosing.
    expect(cal.curriculum.ageGroupId).toBe(ageGroup);
    expect(cal.theme).toBe("Seasons");
    const byDay = Object.fromEntries(Object.values(cal.days).filter((d) => d.day).map((d) => [d.day, d.lessons.map((l) => l.title)]));
    // The Christian lesson and the untyped one aren't on a Standard account.
    expect(byDay[1]).toEqual([`ND lesson ${stamp}`]);
    expect(byDay[2]).toEqual(["Circle time"]);

    // The age group must be one on the account.
    expect((await apiPut(request, "/api/v1/lesson-calendar/age-group", { centerId: subCenterId, classRoomId: subRoomId, ageGroupId: "not-an-age-group" }, sub)).status()).toBe(400);
    expect((await apiPut(request, "/api/v1/lesson-calendar/age-group", { centerId: subCenterId, classRoomId: subRoomId, ageGroupId: ageGroup }, sub)).status()).toBe(200);
    expect((await prisma.classRoom.findUnique({ where: { id: subRoomId } }))?.curriculumAgeGroupId).toBe(ageGroup);

    // Another account's admin can't read this calendar.
    const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
    expect((await apiGet(request, `/api/v1/lesson-calendar?${q}`, demo)).status()).toBe(403);
  });

  test("Ameris Academy's own classrooms choose the age group they follow too", async ({ request }) => {
    // Client sheet 10-29 (9), row 3: the Follows Age Group field on Ameris
    // Academy's Lesson Calendar, like subscribers have. Every lesson type shows.
    const room = await prisma.classRoom.create({ data: { name: `QA Ameris Room ${stamp}`, centerId: source.id } });
    try {
      const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
      const start = nextWeekday();
      expect((await apiPut(request, "/api/v1/lesson-calendar", { centerId: source.id, classRoomId: room.id, startDate: start, dayNumber: 1, closedDays: [] }, demo)).status()).toBe(200);
      const q = new URLSearchParams({ centerId: source.id, classRoomId: room.id, from: start, to: addDays(start, 6) });
      const before = await (await apiGet(request, `/api/v1/lesson-calendar?${q}`, demo)).json();
      expect(before.curriculum.chooseAgeGroup).toBe(true);
      expect(before.curriculum.ageGroupId).toBeNull();
      expect(before.curriculum.ageGroups.map((g) => g.id)).toContain(ageGroup);

      expect((await apiPut(request, "/api/v1/lesson-calendar/age-group", { centerId: source.id, classRoomId: room.id, ageGroupId: "not-an-age-group" }, demo)).status()).toBe(400);
      expect((await apiPut(request, "/api/v1/lesson-calendar/age-group", { centerId: source.id, classRoomId: room.id, ageGroupId: ageGroup }, demo)).status()).toBe(200);
      const cal = await (await apiGet(request, `/api/v1/lesson-calendar?${q}`, demo)).json();
      expect(cal.curriculum.ageGroupId).toBe(ageGroup);
      expect(cal.theme).toBe("Seasons");
      const byDay = Object.fromEntries(Object.values(cal.days).filter((d) => d.day).map((d) => [d.day, d.lessons.map((l) => l.title).sort()]));
      expect(byDay[1]).toEqual([`Christian lesson ${stamp}`, `ND lesson ${stamp}`].sort());
      expect(byDay[2]).toEqual(["Circle time", `Untyped lesson ${stamp}`].sort());
    } finally {
      await prisma.lessonCalendarAnchor.deleteMany({ where: { classRoomId: room.id } });
      await prisma.classRoom.delete({ where: { id: room.id } }).catch(() => {});
    }
  });

  test("Ameris Academy's other centers follow the Ameris age-group planners too", async ({ request }) => {
    // Client sheet 10-29 (10), row 8: on Ameris Academy only one planner came
    // over. Its centers other than the curriculum center looked for planners
    // in their own center, which has none.
    const other = await prisma.center.findFirst({
      where: { subscriberAccountId: source.subscriberAccountId, curriculumSource: false, name: "Demo Center 2" },
    });
    expect(other, "the dev database needs Demo Center 2 in the curriculum center's account").toBeTruthy();
    const room = await prisma.classRoom.create({ data: { name: `QA Ameris Other Room ${stamp}`, centerId: other.id } });
    try {
      const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
      const start = nextWeekday();
      expect((await apiPut(request, "/api/v1/lesson-calendar", { centerId: other.id, classRoomId: room.id, startDate: start, dayNumber: 1, closedDays: [] }, demo)).status()).toBe(200);
      const q = new URLSearchParams({ centerId: other.id, classRoomId: room.id, from: start, to: addDays(start, 6) });
      const before = await (await apiGet(request, `/api/v1/lesson-calendar?${q}`, demo)).json();
      expect(before.curriculum.chooseAgeGroup).toBe(true);
      expect(before.curriculum.ageGroups.map((g) => g.id)).toContain(ageGroup);
      expect((await apiPut(request, "/api/v1/lesson-calendar/age-group", { centerId: other.id, classRoomId: room.id, ageGroupId: ageGroup }, demo)).status()).toBe(200);
      const cal = await (await apiGet(request, `/api/v1/lesson-calendar?${q}`, demo)).json();
      expect(cal.curriculum.ageGroupId).toBe(ageGroup);
      expect(cal.theme).toBe("Seasons");
      const byDay = Object.fromEntries(Object.values(cal.days).filter((d) => d.day).map((d) => [d.day, d.lessons.map((l) => l.title).sort()]));
      expect(byDay[1]).toEqual([`Christian lesson ${stamp}`, `ND lesson ${stamp}`].sort());
      // The teacher's weekly plan reads the same planner.
      const week = await apiGet(request, `/api/v1/lesson-planner/week?centerId=${other.id}&classRoomId=${room.id}&start=${start}`, demo);
      expect(week.status(), await week.text()).toBe(200);
      expect(JSON.stringify(await week.json())).toContain(`ND lesson ${stamp}`);
    } finally {
      await prisma.lessonCalendarAnchor.deleteMany({ where: { classRoomId: room.id } });
      await prisma.classRoom.delete({ where: { id: room.id } }).catch(() => {});
    }
  });

  test("Global admin edits the Ameris curriculum on Lesson Bank & SOP; Ameris Academy keeps only the calendar", async ({ request }) => {
    // Client sheet 10-29 (9), rows 4/5: the Lesson Planner, Lesson Bank,
    // Categories and Steps of Progression Bank moved under Global admin. The
    // Global admin uses the same APIs, signed in as Global admin.
    const global = await getAuthCookie(request, globalEmail, password);
    const made = await apiPost(request, "/api/v1/lessons", { centerId: source.id, title: `QA Global lesson ${stamp}` }, global);
    expect(made.status(), await made.text()).toBe(201);
    lessonIds.push((await made.json()).id);
    expect((await apiGet(request, `/api/v1/curriculum-options?centerId=${source.id}`, global)).status()).toBe(200);
    const plans = await apiGet(request, `/api/v1/curriculum-plans?centerId=${source.id}`, global);
    expect(plans.status()).toBe(200);
    expect((await plans.json()).ageRanges).toContain(ageGroup);
    // Only the curriculum center: a subscriber's center stays closed.
    expect((await apiPost(request, "/api/v1/lessons", { centerId: subCenterId, title: `QA not here ${stamp}` }, global)).status()).toBe(403);

    // A Global team member without Lesson Bank / SOP Bank edit rights can look but not change.
    const salesEmail = `curr-sales-${stamp}@curriculum-test.local`;
    await makeUser(salesEmail, { role: "GLOBAL_ADMIN", roles: ["GLOBAL_ADMIN"], globalTeamRole: "SALES" });
    const sales = await getAuthCookie(request, salesEmail, password);
    expect((await apiGet(request, `/api/v1/lessons?centerId=${source.id}&kind=lesson`, sales)).status()).toBe(200);
    expect((await apiPost(request, "/api/v1/lessons", { centerId: source.id, title: `QA sales ${stamp}` }, sales)).status()).toBe(403);

    // Ameris Academy's account is the curriculum owner: its Admin portal keeps
    // only the Lesson Calendar.
    const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
    const mine = await (await apiGet(request, "/api/v1/account", demo)).json();
    expect(mine.account.curriculumOwner).toBe(true);
    const sub = await getAuthCookie(request, subEmail, password);
    expect((await (await apiGet(request, "/api/v1/account", sub)).json()).account.curriculumOwner).toBe(false);
  });

  test("Ameris changes show right away, and the teacher's week uses the Ameris planner", async ({ request }) => {
    await prisma.lessonPlanCell.updateMany({ where: { planId, day: 1, rowIndex: 1 }, data: { lessonId: ids.nd, title: "Changed by Ameris" } });
    const teacher = await getAuthCookie(request, teacherEmail, password);
    const start = nextWeekday();
    const monday = (() => {
      const d = new Date(`${start}T12:00:00`);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const res = await apiGet(request, `/api/v1/lesson-planner/week?${new URLSearchParams({ centerId: subCenterId, classRoomId: subRoomId, start: monday })}`, teacher);
    expect(res.status(), await res.text()).toBe(200);
    const week = await res.json();
    expect(week.curriculum).toBe("AMERIS");
    const day1 = week.days.find((d) => d.day === 1);
    expect(day1).toBeTruthy();
    expect(Object.values(day1.cells).map((c) => c.title).sort()).toEqual([`ND lesson ${stamp}`, "Changed by Ameris"].sort());
    // The teacher can open the lesson (view-only details).
    expect((await apiGet(request, `/api/v1/lessons/${ids.nd}`, teacher)).status()).toBe(200);
  });

  test("Ameris Academy follows its own account's type, and an empty planner never hides a filled one", async ({ request }) => {
    // Client 2026-11-21: Ameris Academy's 2 Year Olds calendar was blank. The
    // lessons were in typed plans; opening the planner had made an empty
    // "All types" plan, which the calendar picked. Ameris Academy = Other.
    const group = `Typed Group ${stamp}`;
    await prisma.curriculumOption.create({ data: { centerId: source.id, kind: "AGE_RANGE", name: group } });
    const owner = await prisma.subscriberAccount.findUnique({ where: { id: source.subscriberAccountId } });
    const room = await prisma.classRoom.create({ data: { name: `QA Typed Room ${stamp}`, centerId: source.id, curriculumAgeGroupId: group } });
    const makePlan = async (type, title) => {
      const plan = await prisma.curriculumPlan.create({ data: { centerId: source.id, ageRange: group, type, dayCount: 1 } });
      if (title) await prisma.lessonPlanCell.create({ data: { centerId: source.id, planId: plan.id, day: 1, rowIndex: 0, title } });
      return plan;
    };
    try {
      const empty = await makePlan(""); // what opening the planner used to create
      await makePlan("NON_DENOMINATIONAL_CHRISTIAN", "Christian day one");
      await makePlan("OTHER", "Other day one");

      const demo = await getAuthCookie(request, "admin@demo.com", "adminpass");
      const start = nextWeekday();
      expect((await apiPut(request, "/api/v1/lesson-calendar", { centerId: source.id, classRoomId: room.id, startDate: start, dayNumber: 1, closedDays: [] }, demo)).status()).toBe(200);
      const q = new URLSearchParams({ centerId: source.id, classRoomId: room.id, from: start, to: start });
      const day1 = async () => Object.values((await (await apiGet(request, `/api/v1/lesson-calendar?${q}`, demo)).json()).days).find((d) => d.day === 1);

      // Every type on the account: the first type with lessons, not the empty "All types".
      await prisma.subscriberAccount.update({ where: { id: owner.id }, data: { curriculumTypes: ["NON_DENOMINATIONAL", "NON_DENOMINATIONAL_CHRISTIAN", "OTHER"] } });
      expect((await day1()).lessons.map((l) => l.title)).toEqual(["Christian day one"]);
      // Only Other on the account: the Other planner.
      await prisma.subscriberAccount.update({ where: { id: owner.id }, data: { curriculumTypes: ["OTHER"] } });
      expect((await day1()).lessons.map((l) => l.title)).toEqual(["Other day one"]);

      // The Planners list shows each planner, its lessons and who follows it.
      const list = await (await apiGet(request, `/api/v1/curriculum-plans?centerId=${source.id}`, demo)).json();
      const mine = list.plans.filter((p) => p.ageRange === group);
      expect(mine.map((p) => [p.type, p.lessons, p.dayCount])).toEqual([
        ["", 0, 1],
        ["NON_DENOMINATIONAL_CHRISTIAN", 1, 1],
        ["OTHER", 1, 1],
      ]);
      expect(list.followers[group.toLowerCase()].join(" ")).toContain(`QA Typed Room ${stamp}`);

      // Only an empty planner can be deleted.
      const filled = mine.find((p) => p.type === "OTHER");
      expect((await apiDelete(request, `/api/v1/curriculum-plans/${filled.id}?centerId=${source.id}`, demo)).status()).toBe(409);
      const teacher = await getAuthCookie(request, teacherEmail, password);
      expect((await apiDelete(request, `/api/v1/curriculum-plans/${empty.id}?centerId=${source.id}`, teacher)).status()).toBe(403);
      expect((await apiDelete(request, `/api/v1/curriculum-plans/${empty.id}?centerId=${source.id}`, demo)).status()).toBe(200);
      expect(await prisma.curriculumPlan.findUnique({ where: { id: empty.id } })).toBeNull();
    } finally {
      await prisma.subscriberAccount.update({ where: { id: owner.id }, data: { curriculumTypes: owner.curriculumTypes } });
      await prisma.lessonCalendarAnchor.deleteMany({ where: { classRoomId: room.id } });
      await prisma.classRoom.delete({ where: { id: room.id } }).catch(() => {});
      await prisma.curriculumPlan.deleteMany({ where: { centerId: source.id, ageRange: group } });
      await prisma.curriculumOption.deleteMany({ where: { centerId: source.id, kind: "AGE_RANGE", name: group } });
    }
  });

  test("Ameris plans per age group and type; a Standard subscriber follows the Standard plan", async ({ request }) => {
    // Client sheet 10-29, rows 3/4: the Lesson Planner's Age Group comes from
    // the Categories age ranges, and each age group can have a plan per Type.
    const ameris = await getAuthCookie(request, "admin@demo.com", "adminpass"); // admin of the curriculum center
    const list = await (await apiGet(request, `/api/v1/curriculum-plans?centerId=${source.id}`, ameris)).json();
    expect(list.ageRanges).toContain(ageGroup);
    expect(list.types.map((t) => t.value)).toEqual(["", "NON_DENOMINATIONAL", "NON_DENOMINATIONAL_CHRISTIAN", "OTHER"]);
    expect((await apiPost(request, "/api/v1/curriculum-plans", { centerId: source.id, ageRange: "Not on the list", type: "" }, ameris)).status()).toBe(400);
    // No new "All types" planners (client sheet 10-29 (11), row 64); the existing one still opens.
    const opened = await apiPost(request, "/api/v1/curriculum-plans", { centerId: source.id, ageRange: ageGroup, type: "" }, ameris);
    expect((await opened.json()).id).toBe(planId);
    const bare = await prisma.curriculumOption.create({ data: { centerId: source.id, kind: "AGE_RANGE", name: `QA No All ${stamp}` } });
    try {
      expect((await apiPost(request, "/api/v1/curriculum-plans", { centerId: source.id, ageRange: bare.name, type: "" }, ameris)).status()).toBe(400);
    } finally {
      await prisma.curriculumOption.delete({ where: { id: bare.id } });
    }

    const created = await apiPost(request, "/api/v1/curriculum-plans", { centerId: source.id, ageRange: ageGroup, type: "NON_DENOMINATIONAL" }, ameris);
    expect(created.status(), await created.text()).toBe(200);
    typedPlanId = (await created.json()).id;
    expect(typedPlanId).not.toBe(planId);

    const put = (body) => apiPut(request, "/api/v1/lesson-planner", { centerId: source.id, planId: typedPlanId, ...body }, ameris);
    expect((await put({ action: "setCell", day: 1, rowIndex: 0, lessonId: ids.nd })).status()).toBe(200);
    const plan = await (await put({ action: "setTheme", theme: "Standard plan" })).json();
    expect(plan.cells).toEqual([{ day: 1, rowIndex: 0, lessonId: ids.nd, title: `ND lesson ${stamp}` }]);
    expect(plan.theme).toBe("Standard plan");
    // The rows API works on plans too.
    const rows = await (await apiGet(request, `/api/v1/lesson-plan-rows?${new URLSearchParams({ centerId: source.id, planId: typedPlanId })}`, ameris)).json();
    expect(rows.length).toBeGreaterThan(0);
    // Subscribers can't change Ameris's plans.
    const sub = await getAuthCookie(request, subEmail, password);
    expect((await apiPut(request, "/api/v1/lesson-planner", { centerId: source.id, planId: typedPlanId, action: "addDay" }, sub)).status()).toBe(403);

    // The Standard account now follows the Standard plan instead of "All types".
    const start = nextWeekday();
    const q = new URLSearchParams({ centerId: subCenterId, classRoomId: subRoomId, from: start, to: addDays(start, 6) });
    const cal = await (await apiGet(request, `/api/v1/lesson-calendar?${q}`, sub)).json();
    expect(cal.theme).toBe("Standard plan");
    const day1 = Object.values(cal.days).find((d) => d.day === 1);
    expect(day1.lessons.map((l) => l.title)).toEqual([`ND lesson ${stamp}`]);
  });

  test("the Initial Developmental Assessment uses the Ameris steps of the account's types", async ({ request }) => {
    const sub = await getAuthCookie(request, subEmail, password);
    const res = await apiGet(request, `/api/v1/sop/${childId}?view=assessment&all=1`, sub);
    expect(res.status(), await res.text()).toBe(200);
    const titles = (await res.json()).steps.map((s) => s.title);
    expect(titles).toContain(`ND step ${stamp}`);
    expect(titles).not.toContain(`Christian step ${stamp}`);

    const bad = await apiPut(request, `/api/v1/sop/${childId}`, { mode: "assessment", levels: [{ stepId: ids.stepNdc, level: "EXPOSURE" }] }, sub);
    expect(bad.status()).toBe(400);
    const ok = await apiPut(request, `/api/v1/sop/${childId}`, { mode: "assessment", levels: [{ stepId: ids.stepNd, level: "EXPOSURE" }] }, sub);
    expect(ok.status(), await ok.text()).toBe(200);
    const goals = await (await apiGet(request, `/api/v1/sop/${childId}`, sub)).json();
    expect(JSON.stringify(goals)).toContain(`ND step ${stamp}`);
  });
});
