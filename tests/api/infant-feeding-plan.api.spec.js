// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsParent, loginAsTeacher, loginAsKitchenStaff } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiDelete, pickDemoCenterId } = require("../helpers/api");

const URL = "/api/v1/reports/infant-feeding-plan";

function monthsAgo(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

test.describe("Infant Feeding Plan report @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;
  const created = [];

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    for (const id of created) await apiDelete(request, `/api/v1/children/${id}`, admin);
  });

  test("lists infants with the feeding plan from their profile, and follows edits", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = pickDemoCenterId(await (await apiGet(request, "/api/v1/centers", admin)).json());
    const stamp = Date.now();

    for (const [name, birthDate] of [[`Infant${stamp}`, monthsAgo(5)], [`Toddler${stamp}`, monthsAgo(14)]]) {
      const res = await apiPost(
        request,
        "/api/v1/children",
        { centerId, firstName: name, lastName: "QA", birthDate, feedingPlan: { formula: "Similac", bottlesPerDay: 4 } },
        admin,
      );
      expect(res.status(), await res.text()).toBe(201);
      created.push((await res.json()).id);
    }

    const kitchen = await loginAsKitchenStaff(request);
    const first = await (await apiGet(request, `${URL}?centerId=${centerId}`, kitchen)).json();
    const infant = first.infants.find((c) => c.firstName === `Infant${stamp}`);
    expect(infant.feedingPlan).toEqual({ foods: null, formula: "Similac", bottlesPerDay: 4, bottleNotes: null });
    expect(first.infants.some((c) => c.firstName === `Toddler${stamp}`)).toBe(false);
    // Only what the kitchen needs.
    expect(Object.keys(infant).sort()).toEqual(["allergies", "birthDate", "classRoomId", "feedingPlan", "firstName", "id", "lastName"]);

    const edit = await apiPut(request, `/api/v1/children/${created[0]}`, { feedingPlan: { formula: "Enfamil", bottlesPerDay: 5, foods: "Rice cereal" } }, admin);
    expect(edit.status(), await edit.text()).toBe(200);
    const after = await (await apiGet(request, `${URL}?centerId=${centerId}`, admin)).json();
    expect(after.infants.find((c) => c.id === created[0]).feedingPlan).toMatchObject({ formula: "Enfamil", bottlesPerDay: 5, foods: "Rice cereal" });
  });

  test("only admins, coaches and kitchen staff can open it", async ({ request }) => {
    expect((await apiGet(request, URL)).status()).toBe(401);
    expect((await apiGet(request, URL, await loginAsParent(request))).status()).toBe(403);
    expect((await apiGet(request, URL, await loginAsTeacher(request))).status()).toBe(403);
  });
});
