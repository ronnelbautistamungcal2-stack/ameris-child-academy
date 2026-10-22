import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
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
    lessonDocument,
    lessonImage,
    notes,
    theme,
    type,
    link,
    supplies,
  } = req.body || {};

  const existing = await prisma.lessonGoal.findUnique({
    where: { id: goalId },
    include: { lesson: true },
  });
  if (!existing) return res.status(404).json({ error: "Record not found" });

  const previousPc = getPassingCriteriaObject(existing.passingCriteria);
  // The form no longer edits the progression step, so keep the one an
  // imported record already has and fall back to the lesson title. A step
  // that was only ever a copy of the title follows the title when it changes.
  const previousStep = normalizeSpaces(previousPc.stepOfProgression);
  const stepWasTitle = !previousStep || previousStep === normalizeSpaces(previousPc.lesson);
  const step =
    normalizeSpaces(progressionStep) ||
    (stepWasTitle ? normalizeSpaces(lessonTitle) : previousStep) ||
    previousStep ||
    existing.title;
  if (!step) return res.status(400).json({ error: "lessonTitle is required" });
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
  const hasLessonDocument = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "lessonDocument",
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
    ? normalizeResourceList(lessonAttachment)
    : normalizeResourceList(previousPc.lessonAttachment);
  const nextLessonDocument = hasLessonDocument
    ? normalizeResourceList(lessonDocument)
    : normalizeResourceList(previousPc.lessonDocument);
  const nextLessonImage = hasLessonImage
    ? normalizeResourceList(lessonImage)
    : normalizeResourceList(previousPc.lessonImage);

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "type")) {
      await tx.lesson.update({ where: { id: existing.lessonId }, data: { type: normalizeSpaces(type).slice(0, 80) || null } });
    }
    if (Array.isArray(supplies)) {
      await tx.lessonSupply.deleteMany({ where: { lessonId: existing.lessonId } });
      const validSupplies = supplies.filter((s) => s && normalizeSpaces(s.name));
      if (validSupplies.length) {
        await tx.lessonSupply.createMany({
          data: validSupplies.map((s) => ({
            lessonId: existing.lessonId,
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

    return tx.lessonGoal.update({
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
          lessonDocument: nextLessonDocument,
          lessonImage: nextLessonImage,
          notes: normalizeSpaces(notes),
          // Keep the stored theme when an older client leaves it out.
          theme: Object.prototype.hasOwnProperty.call(req.body || {}, "theme")
            ? normalizeSpaces(theme).slice(0, 120)
            : previousPc.theme || "",
          age: normalizeSpaces(childAge),
          category: normalizeSpaces(category),
          subject: normalizeSubjectForRef({
            subject: normalizeSpaces(subject),
            refId: normalizeSpaces(reference),
          }),
          sheet,
          link: normalizeSpaces(link),
        },
      },
      include: {
        lesson: { include: { category: true, supplies: { orderBy: { name: "asc" } } } },
      },
    });
  });

  return res.status(200).json({ goal: updated });
}
