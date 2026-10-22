// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsCoach, loginAsTeacher, loginAsKitchenStaff } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

function todayKey() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

// Phase 6 checklist changes on a throwaway center: coaches manage checklists,
// one copy per assignee, "No Classroom", the Log Activity gate, a teacher's
// chosen checklist, Checklist Review and the kitchen shopping list.
test.describe("Checklist Manager, checklists and review @api", () => {
  test.describe.configure({ mode: "serial" });
  const today = todayKey();
  let center;
  let room;
  let teacher;
  let kitchen;
  let coach;

  test.beforeAll(async () => {
    [teacher, kitchen, coach] = await Promise.all(
      ["teacher@demo.com", "kitchen@demo.com", "coach@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })),
    );
    center = await prisma.center.create({
      data: {
        name: `QA Checklist Phase6 ${Date.now()}`,
        meals: {
          breakfast: { provided: true, catered: false },
          amSnack: { provided: true, catered: false },
          lunch: { provided: true, catered: true },
          pmSnack: { provided: false, catered: false },
          dinner: { provided: false, catered: false },
          eveningSnack: { provided: false, catered: false },
        },
      },
    });
    await prisma.centerUser.createMany({
      data: [
        { userId: teacher.id, centerId: center.id, role: "TEACHER" },
        { userId: kitchen.id, centerId: center.id, role: "KITCHEN_STAFF" },
        { userId: coach.id, centerId: center.id, role: "COACH" },
      ],
    });
    room = await prisma.classRoom.create({ data: { centerId: center.id, name: "QA Toddlers" } });
    await prisma.teacherClass.create({ data: { teacherId: teacher.id, classId: room.id } });
  });

  test.afterAll(async ({ request }) => {
    if (center) {
      await prisma.teacherClass.deleteMany({ where: { classId: room.id } });
      const res = await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
      expect(res.status(), await res.text()).toBeLessThan(300);
    }
    await prisma.$disconnect();
  });

  test("a coach creates a checklist and each assignee gets their own copy", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const res = await apiPost(
      request,
      "/api/v1/daily-checklists",
      {
        centerId: center.id,
        title: "QA Shared",
        noClassroom: true,
        assignedUserIds: [teacher.id, kitchen.id],
        items: [{ title: "Wipe tables", taskTime: "09:00" }],
      },
      coachCookies,
    );
    expect(res.status(), await res.text()).toBe(201);
    const created = await res.json();
    expect(created.copyIds).toHaveLength(2);
    expect(created.noClassroom).toBe(true);
    expect(created.category).toBe("OTHER");

    const copies = await prisma.dailyChecklist.findMany({
      where: { id: { in: created.copyIds } },
      include: { assignees: true, items: true },
    });
    expect(copies.map((c) => c.assignees.map((a) => a.userId)).sort()).toEqual([[kitchen.id], [teacher.id]].sort());
    expect(copies.every((c) => c.items.length === 1 && c.noClassroom)).toBe(true);

    // Kitchen's tick does not show on the teacher's copy.
    const kitchenCookies = await loginAsKitchenStaff(request);
    const kitchenList = (await (await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}&staffUserId=${kitchen.id}`, kitchenCookies)).json()).find((c) => c.title === "QA Shared");
    expect((await apiPost(request, "/api/v1/daily-checklists/complete", { itemId: kitchenList.items[0].id, date: today }, kitchenCookies)).status()).toBe(200);
    const teacherCopy = copies.find((c) => c.assignees[0].userId === teacher.id);
    expect(await prisma.dailyChecklistCompletion.count({ where: { item: { checklistId: teacherCopy.id } } })).toBe(0);

    // Editing a copy to add a person splits again.
    const put = await apiPut(request, "/api/v1/daily-checklists", { id: teacherCopy.id, assignedUserIds: [teacher.id, coach.id] }, coachCookies);
    expect(put.status(), await put.text()).toBe(200);
    expect((await put.json()).copyIds).toHaveLength(2);
    expect(await prisma.dailyChecklistAssignee.count({ where: { checklistId: teacherCopy.id } })).toBe(1);
  });

  test("teachers cannot manage checklists and coaches only at their centers", async ({ request }) => {
    const teacherCookies = await loginAsTeacher(request);
    expect((await apiPost(request, "/api/v1/daily-checklists", { centerId: center.id, title: "Nope" }, teacherCookies)).status()).toBe(403);
    const other = await prisma.center.create({ data: { name: `QA Other ${Date.now()}` } });
    try {
      const coachCookies = await loginAsCoach(request);
      expect((await apiPost(request, "/api/v1/daily-checklists", { centerId: other.id, title: "Nope" }, coachCookies)).status()).toBe(403);
    } finally {
      await prisma.center.delete({ where: { id: other.id } });
    }
  });

  test("a coach can list a center's staff but not parents", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const res = await apiGet(request, `/api/v1/users?centerId=${center.id}&roles=TEACHER,PARENT`, coachCookies);
    expect(res.status()).toBe(200);
    const users = await res.json();
    expect(users.map((u) => u.id)).toEqual([teacher.id]);
    expect(users[0]).not.toHaveProperty("password");
  });

  test("an item linking to Log Activity can be ticked only after opening it", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const created = await (
      await apiPost(
        request,
        "/api/v1/daily-checklists",
        {
          centerId: center.id,
          title: "QA Log Gate",
          classRoomIds: [room.id],
          assignedUserIds: [teacher.id],
          items: [
            { title: "Log diapers", directLink: "/teacher/logs", taskTime: "10:00" },
            { title: "Other link", directLink: "/teacher/classroom", taskTime: "11:00" },
          ],
        },
        coachCookies,
      )
    ).json();
    const [logItem, otherItem] = created.items;
    const teacherCookies = await loginAsTeacher(request);

    const before = (await (await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}`, teacherCookies)).json()).find((c) => c.id === created.id);
    expect(before.items[0]).toMatchObject({ logActivityLink: true, logActivityVisited: false });
    expect(before.items[1].logActivityLink).toBe(false);

    expect((await apiPost(request, "/api/v1/daily-checklists/complete", { itemId: logItem.id, date: today }, teacherCookies)).status()).toBe(409);
    expect((await apiPost(request, "/api/v1/daily-checklists/visit", { itemId: otherItem.id }, teacherCookies)).status()).toBe(400);
    expect((await apiPost(request, "/api/v1/daily-checklists/visit", { itemId: logItem.id }, teacherCookies)).status()).toBe(200);
    expect((await apiPost(request, "/api/v1/daily-checklists/complete", { itemId: logItem.id, date: today }, teacherCookies)).status()).toBe(200);

    const after = (await (await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}`, teacherCookies)).json()).find((c) => c.id === created.id);
    expect(after.items[0].logActivityVisited).toBe(true);
  });

  test("a teacher's chosen checklist is the one Checklist Review counts", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const second = await (
      await apiPost(
        request,
        "/api/v1/daily-checklists",
        { centerId: center.id, title: "QA Second Room", classRoomIds: [room.id], assignedUserIds: [teacher.id], items: [{ title: "Sweep" }, { title: "Mop" }] },
        coachCookies,
      )
    ).json();
    const teacherCookies = await loginAsTeacher(request);
    const pick = await apiPut(request, "/api/v1/daily-checklists/choice", { date: today, checklistId: second.id }, teacherCookies);
    expect(pick.status(), await pick.text()).toBe(200);
    expect(await (await apiGet(request, `/api/v1/daily-checklists/choice?date=${today}`, teacherCookies)).json()).toEqual({ checklistId: second.id });

    const review = await apiGet(request, `/api/v1/checklist-review?centerId=${center.id}&date=${today}`, coachCookies);
    expect(review.status()).toBe(200);
    const rows = (await review.json()).rows;
    const teacherRow = rows.find((r) => r.id === teacher.id);
    expect(teacherRow).toMatchObject({ checklistTitles: ["QA Second Room"], total: 2, done: 0, status: "NOT_STARTED", area: "QA Toddlers" });
    expect(rows.find((r) => r.id === kitchen.id)).toMatchObject({ total: 1, done: 1, pct: 100, status: "COMPLETE" });

    // A coach marks the teacher's items from View Details.
    const detail = await (await apiGet(request, `/api/v1/checklist-review/${teacher.id}?centerId=${center.id}&date=${today}`, coachCookies)).json();
    expect(detail.row.items.map((i) => i.title)).toEqual(["Sweep", "Mop"]);
    expect(Array.isArray(detail.logs)).toBe(true);
    for (const item of detail.row.items) {
      expect((await apiPost(request, "/api/v1/daily-checklists/complete", { itemId: item.id, date: today, forUserId: teacher.id }, coachCookies)).status()).toBe(200);
    }
    const again = (await (await apiGet(request, `/api/v1/checklist-review?centerId=${center.id}&date=${today}`, coachCookies)).json()).rows;
    expect(again.find((r) => r.id === teacher.id)).toMatchObject({ done: 2, status: "COMPLETE" });

    // Only admins and coaches can mark for someone else or open the review.
    expect((await apiPost(request, "/api/v1/daily-checklists/complete", { itemId: detail.row.items[0].id, date: today, forUserId: kitchen.id }, teacherCookies)).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/checklist-review?centerId=${center.id}&date=${today}`, teacherCookies)).status()).toBe(403);
  });

  test("a coach's own checklist only shows what is assigned to them", async ({ request }) => {
    const coachCookies = await loginAsCoach(request);
    const res = await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}&staffUserId=${coach.id}`, coachCookies);
    expect(res.status()).toBe(200);
    const titles = (await res.json()).map((c) => c.title);
    expect(titles).toEqual(["QA Shared"]);
    // Someone else's checklist is still admin-only.
    expect((await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}&staffUserId=${teacher.id}`, coachCookies)).status()).toBe(403);
    expect((await apiGet(request, `/api/v1/daily-checklists?centerId=${center.id}&date=${today}&staffUserId=${teacher.id}`, await loginAsAdmin(request))).status()).toBe(200);
  });

  test("the kitchen shopping list counts next week's planned items and skips catered meals", async ({ request }) => {
    const start = new Date();
    start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
    const key = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    const monday = key(start);
    const tuesday = key(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1));
    const day = (k) => new Date(`${k}T00:00:00.000Z`);
    await prisma.menuItem.createMany({
      data: [
        { centerId: center.id, date: day(monday), meal: "breakfast", ageGroup: "children", component: "fruit", item: "Apples" },
        { centerId: center.id, date: day(monday), meal: "breakfast", ageGroup: "infant-6-11", component: "fruit", item: "apples" },
        { centerId: center.id, date: day(tuesday), meal: "amSnack", ageGroup: "children", component: "fruit", item: "Apples" },
        { centerId: center.id, date: day(tuesday), meal: "lunch", ageGroup: "children", component: "protein", item: "Chicken" },
        { centerId: center.id, date: day(tuesday), meal: "breakfast", ageGroup: "children", component: "grain", item: "Toast", kind: "SERVED" },
      ],
    });
    const res = await apiGet(request, `/api/v1/menus/shopping-list?centerId=${center.id}`, await loginAsKitchenStaff(request));
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.start).toBe(monday);
    expect(body.items).toEqual([{ item: "Apples", meals: ["Breakfast", "AM Snack"], timesServed: 2 }]);
  });
});
