function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase();
}

// Canonical category names used by StepsOfProgressionLibrary.xlsx.
// Prevents duplicates caused by casing and common misspellings.
const CANONICAL_BY_KEY = Object.freeze({
  // Academics
  "academics": "Academics",
  "academic": "Academics",
  "academincs": "Academics",
  "academics science": "Academics",

  // Development
  "development": "Development",
  "developent": "Development",
  "dvelopment": "Development",
  "developmnet": "Development",
  "develpment": "Development",
  "devlopment": "Development",
  "devleopment": "Development",
  "develpoment": "Development",

  // General
  "general": "General",

  // Life Skills
  "life skills": "Life Skills",
  "life skill": "Life Skills",

  // Lifelong Learning Practices
  "lifelong learning practices": "Lifelong Learning Practices",
  "lifelong learning practice": "Lifelong Learning Practices",
  "life long learning practices": "Lifelong Learning Practices",
  "life long learning practice": "Lifelong Learning Practices",

  // Spiritual
  "spiritual": "Spiritual",
  "spirutal": "Spiritual",
  "spritual": "Spiritual",
});

function toTitleCase(value) {
  const s = normalizeSpaces(value);
  if (!s) return "";
  return s
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function canonicalizeLessonCategoryName(value) {
  const spaced = normalizeSpaces(value);
  if (!spaced) return "";

  const key = normalizeKey(spaced);
  if (CANONICAL_BY_KEY[key]) return CANONICAL_BY_KEY[key];
  return toTitleCase(spaced);
}

export async function normalizeLessonCategoriesForCenter({ prisma, centerId }) {
  if (!prisma) throw new Error("prisma is required");
  if (!centerId) throw new Error("centerId is required");

  const categories = await prisma.lessonCategory.findMany({
    where: { centerId },
    select: { id: true, name: true, createdAt: true },
  });

  const summary = {
    centerId,
    categoriesSeen: categories.length,
    categoriesRenamed: 0,
    categoriesDeleted: 0,
    lessonsReassigned: 0,
  };

  const groups = new Map();
  for (const c of categories) {
    const canonical = canonicalizeLessonCategoryName(c.name);
    if (!canonical) continue;
    const key = normalizeKey(canonical);
    if (!groups.has(key)) groups.set(key, { canonical, items: [] });
    groups.get(key).items.push({ ...c, canonical });
  }

  await prisma.$transaction(async (tx) => {
    for (const g of groups.values()) {
      const items = g.items.slice().sort((a, b) => a.createdAt - b.createdAt);
      const keep = items.find((c) => c.name === g.canonical) || items[0];

      if (keep.name !== g.canonical) {
        await tx.lessonCategory.update({
          where: { id: keep.id },
          data: { name: g.canonical },
        });
        summary.categoriesRenamed += 1;
      }

      for (const other of items) {
        if (other.id === keep.id) continue;

        const updated = await tx.lesson.updateMany({
          where: { categoryId: other.id },
          data: { categoryId: keep.id },
        });
        summary.lessonsReassigned += updated.count || 0;

        await tx.lessonCategory.delete({ where: { id: other.id } });
        summary.categoriesDeleted += 1;
      }
    }
  });

  return summary;
}
