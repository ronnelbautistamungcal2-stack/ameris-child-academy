import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeSubjectForRef } from "@/lib/subjectNormalization.mjs";

function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
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

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
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

  const updated = await prisma.lessonGoal.update({
    where: { id: goalId },
    data: {
      title: step,
      description: normalizeSpaces(testingQuestion) || null,
      passingCriteria: {
        ...previousPc,
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
        sheet,
      },
    },
    include: {
      lesson: { include: { category: true } },
    },
  });

  return res.status(200).json({ goal: updated });
}
