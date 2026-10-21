// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsAdmin, loginAsTeacher, loginAsParent } = require("../helpers/auth");
const { apiGet, apiPost, apiPut, apiPatch, apiDelete } = require("../helpers/api");

// Curriculum > Categories lists, the Add Step extras (Exposure / Competency /
// Mastery, notes) and the lesson Theme, on a throwaway center.
test.describe("Curriculum lists, steps and lesson theme @api", () => {
  test.describe.configure({ mode: "serial" });
  let centerId;

  test.beforeAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    centerId = (await (await apiPost(request, "/api/v1/centers", { name: `QA Curriculum Lists ${Date.now()}` }, admin)).json()).id;
    // A lesson in use, so the lists start from what the center already has.
    const rec = await apiPost(
      request,
      "/api/v1/curriculum/records",
      { centerId, lessonTitle: "QA Leaf Collage", category: "Art", childAge: "3 Years", subject: "Fine Motor", term: "Term 1", theme: "Fall" },
      admin,
    );
    expect(rec.status(), await rec.text()).toBeLessThan(300);
  });

  test.afterAll(async ({ request }) => {
    const admin = await loginAsAdmin(request);
    if (centerId) await apiDelete(request, `/api/v1/centers/${centerId}`, admin);
  });

  test("the lists start from the values in use and can be added to and trimmed", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const url = `/api/v1/curriculum-options?centerId=${centerId}`;
    let lists = await (await apiGet(request, url, admin)).json();
    expect(lists.CATEGORY.map((o) => o.name)).toContain("Art");
    expect(lists.SUBJECT.map((o) => o.name)).toContain("Fine Motor");
    expect(lists.AGE_RANGE.map((o) => o.name)).toContain("3 Years");
    expect(lists.TYPE.map((o) => o.name)).toEqual(["DCCS", "Regular"]);

    const added = await apiPost(request, "/api/v1/curriculum-options", { centerId, kind: "CATEGORY", name: "  Circle   Time " }, admin);
    expect(added.status()).toBe(201);
    expect((await added.json()).name).toBe("Circle Time");
    expect((await apiPost(request, "/api/v1/curriculum-options", { centerId, kind: "CATEGORY", name: "circle time" }, admin)).status()).toBe(409);
    expect((await apiPost(request, "/api/v1/curriculum-options", { centerId, kind: "COLOR", name: "Red" }, admin)).status()).toBe(400);

    // Emptying a list keeps it empty; it is not refilled from the lessons.
    for (const row of lists.TYPE) {
      expect((await apiDelete(request, `/api/v1/curriculum-options?id=${row.id}`, admin)).status()).toBe(204);
    }
    lists = await (await apiGet(request, url, admin)).json();
    expect(lists.TYPE).toEqual([]);
    expect(lists.CATEGORY.map((o) => o.name)).toEqual(expect.arrayContaining(["Art", "Circle Time"]));

    const teacher = await loginAsTeacher(request);
    expect((await apiPost(request, "/api/v1/curriculum-options", { centerId, kind: "TYPE", name: "X" }, teacher)).status()).toBe(403);
    const parent = await loginAsParent(request);
    expect((await apiGet(request, url, parent)).status()).toBe(403);
  });

  test("a step saves its Exposure / Competency / Mastery criteria and notes", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const created = await apiPost(
      request,
      "/api/v1/lessons",
      {
        centerId,
        title: "Holds head up independently",
        reference: "SP-001",
        subCategory: "Gross Motor",
        term: "Term 1",
        ageYears: 0,
        ageMonths: 3,
        description: "Can the child hold their head steady?",
        criteria: { exposure: "With support", competency: " Briefly alone ", mastery: "" },
        notes: "Watch during tummy time",
      },
      admin,
    );
    expect(created.status(), await created.text()).toBe(201);
    const step = await created.json();
    expect(step.criteria).toEqual({ exposure: "With support", competency: "Briefly alone", mastery: null });
    expect(step.notes).toBe("Watch during tummy time");

    // Leaving them out of an edit keeps them.
    const edited = await (await apiPut(request, `/api/v1/lessons/${step.id}`, { title: "Holds head up", media: [] }, admin)).json();
    expect(edited.criteria.exposure).toBe("With support");
    expect(edited.notes).toBe("Watch during tummy time");
  });

  test("a lesson's theme is saved and kept when an edit leaves it out", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const lessons = await (await apiGet(request, `/api/v1/lessons?centerId=${centerId}`, admin)).json();
    const collage = lessons.find((l) => l.title === "QA Leaf Collage");
    const goal = collage.goals[0];
    expect(goal.passingCriteria.theme).toBe("Fall");

    const base = { lessonTitle: "QA Leaf Collage", category: "Art", childAge: "3 Years", term: "Term 1" };
    expect((await apiPatch(request, `/api/v1/curriculum/records/${goal.id}`, { ...base, theme: "Autumn" }, admin)).status()).toBe(200);
    expect((await apiPatch(request, `/api/v1/curriculum/records/${goal.id}`, base, admin)).status()).toBe(200);
    const after = await (await apiGet(request, `/api/v1/lessons?centerId=${centerId}`, admin)).json();
    expect(after.find((l) => l.id === collage.id).goals[0].passingCriteria.theme).toBe("Autumn");
  });

  test("lessons and steps take an optional Type, kept when an edit leaves it out", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const rec = await apiPost(
      request,
      "/api/v1/curriculum/records",
      { centerId, lessonTitle: "QA Counting Bears", reference: "LS-777", category: "Math", childAge: "4 Years", type: "DCCS" },
      admin,
    );
    expect(rec.status(), await rec.text()).toBeLessThan(300);
    let lessons = await (await apiGet(request, `/api/v1/lessons?centerId=${centerId}&kind=lesson`, admin)).json();
    const bears = lessons.find((l) => l.title === "QA Counting Bears");
    expect(bears.type).toBe("DCCS");
    await apiPatch(request, `/api/v1/curriculum/records/${bears.goals[0].id}`, { lessonTitle: "QA Counting Bears", reference: "LS-777", category: "Math", childAge: "4 Years" }, admin);
    lessons = await (await apiGet(request, `/api/v1/lessons?centerId=${centerId}&kind=lesson`, admin)).json();
    expect(lessons.find((l) => l.id === bears.id).type).toBe("DCCS");

    const step = await (await apiPost(request, "/api/v1/lessons", { centerId, isStep: true, title: "QA Typed Step", reference: "SP-T1", type: "Regular" }, admin)).json();
    expect(step.type).toBe("Regular");
    const cleared = await (await apiPut(request, `/api/v1/lessons/${step.id}`, { title: "QA Typed Step", media: [], type: "" }, admin)).json();
    expect(cleared.type).toBeNull();
  });

  test("the steps import links Related Lesson by Ref ID or title", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const res = await apiPost(
      request,
      "/api/v1/lessons/import-steps",
      {
        centerId,
        rows: [
          { line: 2, reference: "SP-R1", title: "Counts to five", relatedLesson: "LS-777", type: "DCCS" },
          { line: 3, reference: "SP-R2", title: "Glues leaves", relatedLesson: "qa leaf collage" },
          { line: 4, reference: "SP-R3", title: "Sorts colors", relatedLesson: "No Such Lesson" },
        ],
      },
      admin,
    );
    expect(res.status(), await res.text()).toBe(200);
    const result = await res.json();
    expect(result.created).toBe(3);
    expect(result.warnings).toEqual([expect.objectContaining({ line: 4, reason: expect.stringContaining("Related Lesson") })]);

    const all = await (await apiGet(request, `/api/v1/lessons?centerId=${centerId}`, admin)).json();
    const byTitle = Object.fromEntries(all.map((l) => [l.title, l]));
    expect(byTitle["Counts to five"].linkedLessonId).toBe(byTitle["QA Counting Bears"].id);
    expect(byTitle["Counts to five"].type).toBe("DCCS");
    expect(byTitle["Glues leaves"].linkedLessonId).toBe(byTitle["QA Leaf Collage"].id);
    expect(byTitle["Sorts colors"].linkedLessonId).toBeNull();

    // A re-import without the column leaves the link alone.
    await apiPost(request, "/api/v1/lessons/import-steps", { centerId, rows: [{ line: 2, reference: "SP-R1", title: "Counts to five" }] }, admin);
    const again = await (await apiGet(request, `/api/v1/lessons?centerId=${centerId}&kind=step`, admin)).json();
    expect(again.find((l) => l.reference === "SP-R1").linkedLessonId).toBe(byTitle["QA Counting Bears"].id);
  });
});
