import { getSession } from "@/lib/auth";
import { normalizeLessonSlot, normalizeTermDaySelections } from "@/lib/lessonScheduling";
import prisma from "@/lib/prisma";

const LESSON_INCLUDE = {
  category: true,
  goals: { orderBy: { goalIndex: "asc" } },
  remediationsFrom: { include: { toLesson: true } },
  supplies: { orderBy: { name: "asc" } },
  policyDocument: true,
  linkedLesson: {
    select: {
      id: true,
      title: true,
      term: true,
      reference: true,
    },
  },
};

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: LESSON_INCLUDE,
    });
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    return res.status(200).json(lesson);
  }

  if (req.method === "PUT") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      title,
      description,
      subCategory,
      term,
      termDays,
      lessonSlot,
      reference,
      media,
      categoryId,
      policyDocumentId,
      linkedLessonId,
      supplies,
    } = req.body;

    const lesson = await prisma.$transaction(async (tx) => {
      if (Object.prototype.hasOwnProperty.call(req.body, "supplies") && Array.isArray(supplies)) {
        await tx.lessonSupply.deleteMany({ where: { lessonId: id } });
        if (supplies.length) {
          await tx.lessonSupply.createMany({
            data: supplies.map((s) => ({
              lessonId: id,
              name: s.name,
              quantity: s.quantity || 1,
              quantityType: s.quantityType === "per_student" ? "per_student" : "total",
              unit: s.unit || null,
              estimatedCost: s.estimatedCost ? parseFloat(s.estimatedCost) : null,
              category: s.category || "General",
              notes: s.notes || null,
            })),
          });
        }
      }

      return tx.lesson.update({
        where: { id },
        data: {
          title,
          description,
          subCategory:
            Object.prototype.hasOwnProperty.call(req.body, "subCategory")
              ? subCategory || null
              : undefined,
          term:
            Object.prototype.hasOwnProperty.call(req.body, "term")
              ? term || null
              : undefined,
          termDays:
            Object.prototype.hasOwnProperty.call(req.body, "termDays")
              ? normalizeTermDaySelections(termDays)
              : undefined,
          lessonSlot:
            Object.prototype.hasOwnProperty.call(req.body, "lessonSlot")
              ? normalizeLessonSlot(lessonSlot)
              : undefined,
          reference:
            Object.prototype.hasOwnProperty.call(req.body, "reference")
              ? reference || null
              : undefined,
          media,
          categoryId:
            Object.prototype.hasOwnProperty.call(req.body, "categoryId")
              ? categoryId || null
              : undefined,
          policyDocumentId:
            Object.prototype.hasOwnProperty.call(req.body, "policyDocumentId")
              ? policyDocumentId || null
              : undefined,
          linkedLessonId:
            Object.prototype.hasOwnProperty.call(req.body, "linkedLessonId")
              ? linkedLessonId || null
              : undefined,
        },
        include: LESSON_INCLUDE,
      });
    });

    return res.status(200).json(lesson);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete lessons" });
    }

    await prisma.lesson.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
