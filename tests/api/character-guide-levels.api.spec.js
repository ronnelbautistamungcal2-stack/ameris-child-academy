// @ts-check
// Character Guide: a level on each branch, and the ages a behavior is for
// (client sheet 10-29 (11), rows 30/31).
const { test, expect } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const { demoAccountId } = require("../helpers/accounts");
const { loginAsAdmin } = require("../helpers/auth");
const { apiPost, apiPut } = require("../helpers/api");

const prisma = new PrismaClient();

test.describe("Character Guide levels and ages @api", () => {
  let category;

  test.beforeAll(async () => {
    category = await prisma.characterCategory.create({ data: { subscriberAccountId: await demoAccountId(prisma), name: `QA Levels ${Date.now()}` } });
  });

  test.afterAll(async () => {
    await prisma.characterBehavior.deleteMany({ where: { categoryId: category.id } });
    await prisma.characterCategory.delete({ where: { id: category.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("each branch keeps its level; the behavior keeps the first branch's; ages are saved", async ({ request }) => {
    const admin = await loginAsAdmin(request);
    const tree = {
      ages: ["Toddlers", "2 Year Olds", "Toddlers"],
      question: { title: "Step 1", prompt: "Why?" },
      branches: [
        { title: "Frustration", level: 3, offenses: [{ steps: ["Breathe"] }] },
        { title: "Tired", level: 1, offenses: [{ steps: ["Rest"] }] },
        { title: "Hungry", offenses: [{ steps: ["Snack"] }] },
      ],
    };
    const res = await apiPost(request, "/api/v1/character-guide/behaviors", { type: "COURSE_CORRECTION", name: "QA Hitting", categoryId: category.id, description: "Hits others", level: 2, tree }, admin);
    expect(res.status(), await res.text()).toBe(201);
    const made = await res.json();
    expect(made.tree.branches.map((b) => b.level)).toEqual([3, 1, 2]); // the last falls back to the behavior's level
    expect(made.level).toBe(3);
    expect(made.tree.ages).toEqual(["Toddlers", "2 Year Olds"]);

    // Without a top-level level it still saves (the field moved to the branches).
    const edited = await apiPut(request, `/api/v1/character-guide/behaviors/${made.id}`, { type: "COURSE_CORRECTION", name: "QA Hitting", categoryId: category.id, description: "Hits others", tree: { ...made.tree, ages: [] } }, admin);
    expect(edited.status(), await edited.text()).toBe(200);
    const saved = await prisma.characterBehavior.findUnique({ where: { id: made.id } });
    expect(saved.tree.ages).toEqual([]);
    expect(saved.tree.branches.map((b) => b.level)).toEqual([3, 1, 2]);
  });
});
