import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeSubjectForRef } from "@/lib/subjectNormalization.mjs";

function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLessonTerm(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return "";
  const numeric = raw.match(/^(?:term\s*)?(\d+)$/i);
  if (numeric) return `Term ${numeric[1]}`;
  return raw;
}

function getPassingCriteriaObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const goalId = String(req.query?.id || "");
  if (!goalId) return res.status(400).json({ error: "id is required" });

  if (req.method === "DELETE") {
    const existing = await prisma.lessonGoal.findUnique({ where: { id: goalId } });
    if (!existing) return res.status(404).json({ error: "Record not found" });
    await prisma.lessonGoal.delete({ where: { id: goalId } });
    return res.status(200).json({ deleted: true });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).end();
  }

  const {
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
  } = req.body || {};

  const step = normalizeSpaces(progressionStep);
  if (!step) return res.status(400).json({ error: "progressionStep is required" });

  const existing = await prisma.lessonGoal.findUnique({
    where: { id: goalId },
    include: { lesson: true },
  });
  if (!existing) return res.status(404).json({ error: "Record not found" });

  const previousPc = getPassingCriteriaObject(existing.passingCriteria);
  const sheet = normalizeSpaces(previousPc.sheet) || "Manual";
  const hasTestingQuestion = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "testingQuestion",
  );
  const hasResource = Object.prototype.hasOwnProperty.call(req.body || {}, "resource");
  const hasAdditionalResources = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "additionalResources",
  );
  const hasLessonAttachment = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "lessonAttachment",
  );
  const hasLessonImage = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "lessonImage",
  );

  const nextTestingQuestion = hasTestingQuestion
    ? normalizeSpaces(testingQuestion)
    : normalizeSpaces(previousPc.testingQuestion);
  const nextResource = hasResource
    ? normalizeSpaces(resource)
    : normalizeSpaces(previousPc.resource);
  const nextAdditionalResources = hasAdditionalResources
    ? normalizeSpaces(additionalResources)
    : normalizeSpaces(previousPc.additionalResources);
  const nextLessonAttachment = hasLessonAttachment
    ? normalizeSpaces(lessonAttachment)
    : normalizeSpaces(previousPc.lessonAttachment);
  const nextLessonImage = hasLessonImage
    ? normalizeSpaces(lessonImage)
    : normalizeSpaces(previousPc.lessonImage);

  const updated = await prisma.lessonGoal.update({
    where: { id: goalId },
    data: {
      title: step,
      description: hasTestingQuestion
        ? nextTestingQuestion || null
        : existing.description,
      passingCriteria: {
        ...previousPc,
        reference: normalizeSpaces(reference),
        term: normalizeLessonTerm(term),
        lesson: normalizeSpaces(lessonTitle),
        stepOfProgression: step,
        testingQuestion: nextTestingQuestion,
        resource: nextResource,
        additionalResources: nextAdditionalResources,
        lessonAttachment: nextLessonAttachment,
        lessonImage: nextLessonImage,
        notes: normalizeSpaces(notes),
        age: normalizeSpaces(childAge),
        category: normalizeSpaces(category),
        subject: normalizeSubjectForRef({
          subject: normalizeSpaces(subject),
          refId: normalizeSpaces(reference),
        }),
        sheet,
      },
    },
    include: {
      lesson: { include: { category: true } },
    },
  });

  return res.status(200).json({ goal: updated });
}
