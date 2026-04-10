import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canonicalizeLessonCategoryName } from "@/lib/lessonCategoryNormalization.mjs";
import { normalizeSubjectForRef } from "@/lib/subjectNormalization.mjs";

function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

async function getOrCreateCategory({ centerId, name, ageRange }) {
  const canonical = canonicalizeLessonCategoryName(name);
  if (!canonical) return null;
  const normalizedAgeRange = normalizeSpaces(ageRange) || null;

  const matches = await prisma.lessonCategory.findMany({
    where: {
      centerId,
      name: { equals: canonical, mode: "insensitive" },
      ageRange: normalizedAgeRange,
    },
    orderBy: { createdAt: "asc" },
  });
  if (matches.length) {
    const preferred = matches.find((c) => c.name === canonical) || matches[0];
    return preferred;
  }

  return prisma.lessonCategory.create({
    data: { centerId, name: canonical, kind: "PACKAGE", ageRange: normalizedAgeRange },
  });
}

async function getOrCreateLesson({ centerId, title, categoryId }) {
  const normalizedTitle = normalizeSpaces(title);
  if (!normalizedTitle) return null;

  const matches = await prisma.lesson.findMany({
    where: { centerId, title: { equals: normalizedTitle, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });

  if (matches.length) {
    const preferred = matches.find((l) => l.title === normalizedTitle) || matches[0];
    if (!preferred.categoryId && categoryId) {
      return prisma.lesson.update({
        where: { id: preferred.id },
        data: { categoryId },
      });
    }
    return preferred;
  }

  return prisma.lesson.create({
    data: {
      centerId,
      title: normalizedTitle,
      categoryId: categoryId || null,
      description: null,
      media: [],
    },
  });
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN")
    return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const {
    centerId,
    lessonTitle,
    childAge,
    term,
    category,
    subject,
    reference,
    progressionStep,
    testingQuestion,
    resource,
    additionalResources,
    notes,
  } = req.body || {};

  const step = normalizeSpaces(progressionStep);
  if (!centerId) return res.status(400).json({ error: "centerId is required" });
  if (!step) return res.status(400).json({ error: "progressionStep is required" });

  const center = await prisma.center.findUnique({ where: { id: centerId } });
  if (!center) return res.status(404).json({ error: "Center not found" });

  const categoryRecord = category
    ? await getOrCreateCategory({ centerId, name: category, ageRange: childAge })
    : null;

  const lesson = await getOrCreateLesson({
    centerId,
    title: lessonTitle || step,
    categoryId: categoryRecord?.id || null,
  });
  if (!lesson) return res.status(400).json({ error: "lessonTitle is required" });

  const maxGoal = await prisma.lessonGoal.aggregate({
    where: { lessonId: lesson.id },
    _max: { goalIndex: true },
  });
  const goalIndex = Number(maxGoal?._max?.goalIndex || 0) + 1;

  const goal = await prisma.lessonGoal.create({
    data: {
      lessonId: lesson.id,
      goalIndex,
      title: step,
      description: normalizeSpaces(testingQuestion) || null,
      passingCriteria: {
        reference: normalizeSpaces(reference),
        term: normalizeSpaces(term),
        lesson: normalizeSpaces(lessonTitle),
        stepOfProgression: step,
        testingQuestion: normalizeSpaces(testingQuestion),
        resource: normalizeSpaces(resource),
        additionalResources: normalizeSpaces(additionalResources),
        notes: normalizeSpaces(notes),
        age: normalizeSpaces(childAge),
        category: normalizeSpaces(category),
        subject: normalizeSubjectForRef({
          subject: normalizeSpaces(subject),
          refId: normalizeSpaces(reference),
        }),
        sheet: "Manual",
      },
    },
  });

  const updated = await prisma.lesson.findUnique({
    where: { id: lesson.id },
    include: {
      category: true,
      goals: { orderBy: { goalIndex: "asc" } },
      remediationsFrom: { include: { toLesson: true } },
    },
  });

  return res.status(201).json({ lesson: updated, goal });
}
