// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete } = require("../helpers/api");

const SCHEDULE = {
  monday: { open: true, start: "07:30", end: "16:45" },
  tuesday: { open: true, start: "07:30", end: "16:45" },
  wednesday: { open: true, start: "07:30", end: "16:45" },
  thursday: { open: true, start: "07:30", end: "16:45" },
  friday: { open: true, start: "07:30", end: "16:45" },
  saturday: { open: false },
  sunday: { open: false },
};

test.describe("Add/Edit Center settings @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (centerId) await apiDelete(request, `/api/v1/centers/${centerId}`, admin);
  });

  test("saves all four tabs and reads them back", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const users = await (await apiGet(request, "/api/v1/users?staffOnly=true", admin)).json();
    const director = users.find((u) => u.email === "coach@demo.com");

    const res = await apiPost(
      request,
      "/api/v1/centers",
      {
        name: `QA Setup Center ${Date.now()}`,
        centerType: "Preschool",
        status: "UNDER_REVIEW",
        address: "123 Maple Ave",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        directorId: director.id,
        contactEmail: "front@example.com",
        phone: "(555) 010-0100",
        classroomCount: "6",
        capacity: 80,
        region: "North",
        notes: "Test center",
        careSchedule: SCHEDULE,
        autoCheckoutTime: "17:00",
        mealAgeGroups: [{ fromMonths: 36, toMonths: 144 }, { fromMonths: 12, toMonths: 24 }],
        meals: { breakfast: { provided: true, catered: true }, lunch: { provided: true }, dinner: { provided: false, catered: true } },
        ageRates: [{ label: "0-23 Months", monthly: "$1,250.00", weekly: "", daily: 0, hourly: null }],
        enrollmentFee: "75",
        roleAccess: ["ADMIN", "kitchen_staff"],
      },
      admin,
    );
    expect(res.status()).toBe(201);
    centerId = (await res.json()).id;

    const center = await (await apiGet(request, `/api/v1/centers/${centerId}`, admin)).json();
    expect(center.status).toBe("UNDER_REVIEW");
    expect(center.director.id).toBe(director.id);
    expect(center.classroomCount).toBe(6);
    expect(center.careSchedule.saturday).toEqual({ open: false, start: null, end: null });
    expect(center.autoCheckoutTime).toBe("17:00");
    // Meal age groups come back sorted youngest first.
    expect(center.mealAgeGroups).toEqual([{ fromMonths: 12, toMonths: 24 }, { fromMonths: 36, toMonths: 144 }]);
    // A meal that is not provided cannot be catered.
    expect(center.meals.breakfast).toEqual({ provided: true, catered: true });
    expect(center.meals.dinner).toEqual({ provided: false, catered: false });
    expect(center.meals.amSnack).toEqual({ provided: false, catered: false });
    expect(center.ageRates[0]).toEqual({ label: "0-23 Months", monthly: 1250, weekly: null, daily: 0, hourly: null });
    expect(center.enrollmentFee).toBe(75);
    expect(center.roleAccess.sort()).toEqual(["ADMIN", "KITCHEN_STAFF"]);

    const list = await (await apiGet(request, "/api/v1/centers", admin)).json();
    const listed = list.find((c) => c.id === centerId);
    expect(listed._count.children).toBe(0);
    expect(listed.director.name).toBeTruthy();
  });

  test("a partial update leaves the other settings alone", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const res = await apiPut(request, `/api/v1/centers/${centerId}`, { meals: { lunch: { provided: true, catered: true } } }, admin);
    expect(res.status()).toBe(200);
    const center = await (await apiGet(request, `/api/v1/centers/${centerId}`, admin)).json();
    expect(center.meals.lunch).toEqual({ provided: true, catered: true });
    expect(center.meals.breakfast.provided).toBe(false);
    expect(center.city).toBe("Springfield");
    expect(center.careSchedule.monday.start).toBe("07:30");
  });

  test("invalid settings are rejected", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const url = `/api/v1/centers/${centerId}`;
    const users = await (await apiGet(request, "/api/v1/users", admin)).json();
    const parent = users.find((u) => u.email === "parent@demo.com");
    const bad = [
      { careSchedule: { ...SCHEDULE, monday: { open: true, start: "17:00", end: "08:00" } } },
      { careSchedule: { ...SCHEDULE, tuesday: { open: true } } },
      { mealAgeGroups: [{ fromMonths: 12, toMonths: 36 }, { fromMonths: 24, toMonths: 60 }] },
      { mealAgeGroups: [{ fromMonths: 48, toMonths: 24 }] },
      { ageRates: [{ label: "", monthly: 10 }] },
      { ageRates: [{ label: "Toddlers", monthly: -5 }] },
      { status: "OPEN" },
      { roleAccess: ["SUBSCRIBER"] },
      { contactEmail: "not-an-email" },
      { directorId: parent.id },
      { name: "" },
    ];
    for (const body of bad) {
      const res = await apiPut(request, url, body, admin);
      expect(res.status(), JSON.stringify(body)).toBe(400);
    }

    const teacher = await loginAsTeacher(request);
    expect((await apiPost(request, "/api/v1/centers", { name: "Nope" }, teacher)).status()).toBe(403);
  });
});
