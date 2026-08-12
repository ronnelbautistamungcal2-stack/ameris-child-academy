import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canonicalizeLessonCategoryName } from "@/lib/lessonCategoryNormalization.mjs";
import { normalizeSubjectForRef } from "@/lib/subjectNormalization.mjs";

function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

// Preserves newline delimiters between multiple resource URLs so they don't
// get collapsed into a single unusable string by normalizeSpaces().
function normalizeResourceList(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .filter(Boolean)
    .join("\n");
}

function normalizeLessonTerm(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return "";
  const numeric = raw.match(/^(?:term\s*)?(\d+)$/i);
  if (numeric) return `Term ${numeric[1]}`;
  return raw;
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
    orderBy: { id: "asc" },
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
    lessonAttachment,
    lessonImage,
    notes,
    link,
    essentialQuestions,
    keyVocabulary,
    notesToTeacher,
    introduction,
    instructionalSetting,
    learningActivities,
    accommodations,
    timeRequired,
    supplies,
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

  const hasTestingQuestion = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "testingQuestion",
  );
  const hasResource = Object.prototype.hasOwnProperty.call(req.body || {}, "resource");
  const hasAdditionalResources = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "additionalResources",
  );

  const goal = await prisma.lessonGoal.create({
    data: {
      lessonId: lesson.id,
      goalIndex,
      title: step,
      description: hasTestingQuestion ? normalizeSpaces(testingQuestion) || null : null,
      passingCriteria: {
        reference: normalizeSpaces(reference),
        term: normalizeLessonTerm(term),
        lesson: normalizeSpaces(lessonTitle),
        stepOfProgression: step,
        testingQuestion: hasTestingQuestion ? normalizeSpaces(testingQuestion) : "",
        resource: hasResource ? normalizeSpaces(resource) : "",
        additionalResources: hasAdditionalResources
          ? normalizeSpaces(additionalResources)
          : "",
        lessonAttachment: normalizeResourceList(lessonAttachment),
        lessonImage: normalizeResourceList(lessonImage),
        notes: normalizeSpaces(notes),
        age: normalizeSpaces(childAge),
        category: normalizeSpaces(category),
        subject: normalizeSubjectForRef({
          subject: normalizeSpaces(subject),
          refId: normalizeSpaces(reference),
        }),
        sheet: "Manual",
        link: normalizeSpaces(link),
        essentialQuestions: normalizeSpaces(essentialQuestions),
        keyVocabulary: normalizeSpaces(keyVocabulary),
        notesToTeacher: normalizeSpaces(notesToTeacher),
        introduction: normalizeSpaces(introduction),
        instructionalSetting: normalizeSpaces(instructionalSetting),
        learningActivities: normalizeSpaces(learningActivities),
        accommodations: normalizeSpaces(accommodations),
        timeRequired: normalizeSpaces(timeRequired),
      },
    },
  });

  if (Array.isArray(supplies) && supplies.length) {
    const validSupplies = supplies.filter((s) => s && normalizeSpaces(s.name));
    if (validSupplies.length) {
      await prisma.lessonSupply.createMany({
        data: validSupplies.map((s) => ({
          lessonId: lesson.id,
          name: normalizeSpaces(s.name),
          quantity: Number(s.quantity) > 0 ? Number(s.quantity) : 1,
          quantityType: s.quantityType === "per_student" ? "per_student" : "total",
          unit: normalizeSpaces(s.unit) || null,
          estimatedCost: s.estimatedCost ? parseFloat(s.estimatedCost) : null,
          category: normalizeSpaces(s.category) || "General",
          notes: normalizeSpaces(s.notes) || null,
        })),
      });
    }
  }

  const updated = await prisma.lesson.findUnique({
    where: { id: lesson.id },
    include: {
      category: true,
      goals: { orderBy: { goalIndex: "asc" } },
      remediationsFrom: { include: { toLesson: true } },
      supplies: { orderBy: { name: "asc" } },
    },
  });

  return res.status(201).json({ lesson: updated, goal });
}
