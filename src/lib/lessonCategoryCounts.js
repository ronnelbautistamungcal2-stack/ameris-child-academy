import { canonicalizeLessonCategoryName } from "@/lib/lessonCategoryNormalization.mjs";

function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeCategoryName(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return "";
  return canonicalizeLessonCategoryName(raw) || raw;
}

function normalizeAgeRange(value) {
  return normalizeSpaces(value);
}

function categoryKey(name, ageRange) {
  return `${normalizeCategoryName(name).toLowerCase()}::${normalizeAgeRange(ageRange).toLowerCase()}`;
}

function getPassingCriteria(goal) {
  if (!goal?.passingCriteria || Array.isArray(goal.passingCriteria)) return {};
  return typeof goal.passingCriteria === "object" ? goal.passingCriteria : {};
}

function findFallbackCategoryId(name, ageRange, categoryIdsByKey, categoryIdsByName, categoriesById) {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) return "";

  const exactIds = categoryIdsByKey.get(categoryKey(normalizedName, ageRange)) || [];
  if (exactIds.length) return exactIds[0];

  const byName = categoryIdsByName.get(normalizedName.toLowerCase()) || [];
  if (byName.length === 1) return byName[0];

  const blankAgeIds = byName.filter(
    (categoryId) => !normalizeAgeRange(categoriesById.get(categoryId)?.ageRange),
  );
  if (blankAgeIds.length === 1) return blankAgeIds[0];

  return "";
}

function inferCategoryIdForLesson(lesson, categoryIdsByKey, categoryIdsByName, categoriesById) {
  if (lesson?.categoryId && categoriesById.has(lesson.categoryId)) {
    return lesson.categoryId;
  }

  if (lesson?.category?.id && categoriesById.has(lesson.category.id)) {
    return lesson.category.id;
  }

  for (const goal of Array.isArray(lesson?.goals) ? lesson.goals : []) {
    const passingCriteria = getPassingCriteria(goal);
    const inferredCategoryId = findFallbackCategoryId(
      passingCriteria.category,
      passingCriteria.age || passingCriteria.childAge || passingCriteria.ageRange,
      categoryIdsByKey,
      categoryIdsByName,
      categoriesById,
    );
    if (inferredCategoryId) return inferredCategoryId;
  }

  return "";
}

export function attachLessonCountsToCategories(categories, lessons) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeLessons = Array.isArray(lessons) ? lessons : [];

  const categoriesById = new Map(
    safeCategories.map((category) => [category.id, category]),
  );
  const categoryIdsByKey = new Map();
  const categoryIdsByName = new Map();

  for (const category of safeCategories) {
    const normalizedName = normalizeCategoryName(category?.name);
    const key = categoryKey(category?.name, category?.ageRange);
    categoryIdsByKey.set(key, [...(categoryIdsByKey.get(key) || []), category.id]);
    if (normalizedName) {
      const nameKey = normalizedName.toLowerCase();
      categoryIdsByName.set(nameKey, [
        ...(categoryIdsByName.get(nameKey) || []),
        category.id,
      ]);
    }
  }

  const lessonIdsByCategoryId = new Map(
    safeCategories.map((category) => [category.id, new Set()]),
  );

  for (const lesson of safeLessons) {
    const categoryId = inferCategoryIdForLesson(
      lesson,
      categoryIdsByKey,
      categoryIdsByName,
      categoriesById,
    );
    if (!categoryId) continue;
    lessonIdsByCategoryId.get(categoryId)?.add(lesson.id);
  }

  return safeCategories.map((category) => ({
    ...category,
    lessonCount:
      lessonIdsByCategoryId.get(category.id)?.size ??
      category?._count?.lessons ??
      0,
  }));
}
