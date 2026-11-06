import prisma from "@/lib/prisma";

/**
 * The lessons attachLessonCountsToCategories needs ({ id, categoryId,
 * category: { id }, goals: [{ passingCriteria }] }) for every lesson matching
 * `where`. Goals come from their own query rather than nested under each
 * lesson: with a big step bank (~46,000 steps) the nested load crashes
 * Prisma's query engine ("no entry found for key").
 */
export async function lessonsForCategoryCounts(where) {
  const [lessonRows, goalRows] = await Promise.all([
    prisma.lesson.findMany({ where, select: { id: true, categoryId: true } }),
    prisma.lessonGoal.findMany({
      where: { lesson: where },
      orderBy: [{ lessonId: "asc" }, { goalIndex: "asc" }],
      select: { lessonId: true, passingCriteria: true },
    }),
  ]);
  const goalsByLesson = new Map();
  for (const goal of goalRows) {
    if (!goalsByLesson.has(goal.lessonId)) goalsByLesson.set(goal.lessonId, []);
    goalsByLesson.get(goal.lessonId).push({ passingCriteria: goal.passingCriteria });
  }
  return lessonRows.map((lesson) => ({
    id: lesson.id,
    categoryId: lesson.categoryId,
    category: lesson.categoryId ? { id: lesson.categoryId } : null,
    goals: goalsByLesson.get(lesson.id) || [],
  }));
}
