// @ts-check
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { loginAsAdmin, loginAsParent, loginAsTeacher } = require("../helpers/auth");
const { apiDelete, apiGet, apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

// Phase 7b Student Profile (client mockups 07-01..11) on a throwaway center.
test.describe("Student profile and Edit Child tabs (Phase 7b) @api", () => {
  test.describe.configure({ mode: "serial" });
  let center;
  let room;
  let teacher;
  let parent;
  let childId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    center = await (await apiPost(request, "/api/v1/centers", { name: `QA Profile 7b ${Date.now()}` }, admin)).json();
    [teacher, parent] = await Promise.all(["teacher@demo.com", "parent@demo.com"].map((email) => prisma.user.findUnique({ where: { email } })));
    room = await prisma.classRoom.create({ data: { name: "Toddler Room", centerId: center.id } });
    await prisma.centerUser.create({ data: { userId: teacher.id, centerId: center.id, role: "TEACHER" } });
    await prisma.teacherClass.create({ data: { teacherId: teacher.id, classId: room.id } });
  });

  test.afterAll(async ({ request }) => {
    if (childId) {
      await prisma.behaviorPlan.deleteMany({ where: { childId } });
      await prisma.child.delete({ where: { id: childId } }).catch(() => {});
    }
    await prisma.teacherClass.deleteMany({ where: { classId: room?.id } });
    if (center?.id) await apiDelete(request, `/api/v1/centers/${center.id}`, await loginAsAdmin(request));
    await prisma.$disconnect();
  });

  test("admins save every Edit Child tab", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const weekday = { attends: true, dropOff: "08:00", pickUp: "16:00" };
    const res = await apiPost(request, "/api/v1/children", {
      firstName: "Oliver",
      lastName: "Bennett",
      birthDate: "2024-03-03",
      enrollmentStartDate: "2026-01-15",
      centerId: center.id,
      classRoomId: room.id,
      parentAccountIds: [parent.id],
      schedule: { MONDAY: weekday, TUESDAY: weekday, WEDNESDAY: weekday, THURSDAY: weekday, FRIDAY: weekday, SATURDAY: { attends: false } },
      parentContacts: [{ name: "Sarah Bennett", relationship: "Mother", phone: "(555) 123-4567", address: "123 Maple Lane" }],
      emergencyContacts: [{ name: "Michael Bennett", phone: "(555) 987-6543" }],
      outOfAreaContact: { name: "Linda Davis", phone: "(555) 222-3333" },
      healthInfo: { allergies: ["Peanuts"], conditions: ["Sensitive to loud noises"], notes: "Extra supervision outdoors", pediatrician: { name: "Springfield Pediatrics", phone: "(555) 321-7654" } },
      carePlan: { formulaChoice: "OWN_FORMULA", formulaBrand: "Similac", bottlesPerDay: "4", textures: ["Mashed", "Bogus"], foods: { fruits: ["Bananas"] } },
    }, admin);
    expect(res.status(), await res.text()).toBe(201);
    childId = (await res.json()).id;

    const stored = await prisma.child.findUnique({ where: { id: childId } });
    // Health & Safety and the Care Plan keep the existing fields in step.
    expect(stored.allergies).toBe("Peanuts");
    expect(stored.feedingPlan).toMatchObject({ formula: "Similac", bottlesPerDay: 4 });
    expect(stored.carePlan.textures).toEqual(["Mashed"]);
    expect(stored.schedule.SATURDAY).toEqual({ attends: false, dropOff: "", pickUp: "" });

    await prisma.behaviorPlan.create({ data: { childId, centerId: center.id, title: "Transitions" } });
    const profile = await (await apiGet(request, `/api/v1/children/${childId}/profile`, admin)).json();
    expect(profile.classroom).toMatchObject({ name: "Toddler Room", schedule: "Mon – Fri (8:00 AM – 4:00 PM)" });
    expect(profile.redFlags.map((f) => f.text)).toEqual([
      "Allergy - Peanuts",
      "Sensitive to loud noises",
      "Extra supervision outdoors",
      "Individual Progress Plan: Transitions",
    ]);
    expect(profile.emergency.pediatrician.name).toBe("Springfield Pediatrics");
    expect(profile.access).toEqual({ editAll: true, editFamily: true });
  });

  test("teachers view the profile but cannot change the child", async ({ request }) => {
    const teacherCookies = await loginAsTeacher(request);
    const res = await apiGet(request, `/api/v1/children/${childId}/profile`, teacherCookies);
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).access).toEqual({ editAll: false, editFamily: false });
    expect((await apiPut(request, `/api/v1/children/${childId}`, { firstName: "X" }, teacherCookies)).status()).toBe(403);
    expect((await apiPut(request, `/api/v1/children/${childId}/snapshot`, { strengths: "X" }, teacherCookies)).status()).toBe(403);
    expect((await apiPut(request, `/api/v1/children/${childId}/family`, { parentContacts: [] }, teacherCookies)).status()).toBe(403);
  });

  test("parents edit family, emergency contacts and About, not the record", async ({ request }) => {
    const parentCookies = await loginAsParent(request);
    const profile = await (await apiGet(request, `/api/v1/children/${childId}/profile`, parentCookies)).json();
    expect(profile.access).toEqual({ editAll: false, editFamily: true });
    expect(profile.carePlan).toBeUndefined();

    const family = await apiPut(request, `/api/v1/children/${childId}/family`, {
      parentContacts: [{ name: "Sarah Bennett", phone: "(555) 000-1111", email: "sarah@example.com" }],
      emergencyContacts: [{ name: "Grandma Linda", phone: "(555) 444-5555" }],
    }, parentCookies);
    expect(family.status(), await family.text()).toBe(200);
    const about = await apiPut(request, `/api/v1/children/${childId}/snapshot`, { strengths: "Kind, helpful", languages: "English" }, parentCookies);
    expect(about.status(), await about.text()).toBe(200);
    expect((await apiPut(request, `/api/v1/children/${childId}`, { firstName: "X" }, parentCookies)).status()).toBe(403);

    const after = await (await apiGet(request, `/api/v1/children/${childId}/profile`, parentCookies)).json();
    expect(after.family.parents[0].phone).toBe("(555) 000-1111");
    expect(after.emergency.contacts[0].name).toBe("Grandma Linda");
    expect(after.about).toMatchObject({ strengths: "Kind, helpful", languages: "English" });
  });
});
