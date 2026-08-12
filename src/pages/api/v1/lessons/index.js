import { getSession, hasAccessToCenter } from "@/lib/auth";
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

  const { centerId } = req.query;

  if (req.method === "GET") {
    // Teachers/admins/coaches can view lessons
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!centerId && session.user.role !== "ADMIN") {
      return res.status(400).json({ error: "centerId is required" });
    }

    if (centerId && session.user.role !== "ADMIN") {
      const hasAccess = await hasAccessToCenter(session.user.id, centerId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const lessons = await prisma.lesson.findMany({
      where: centerId ? { centerId } : {},
      include: LESSON_INCLUDE,
    });
    return res.status(200).json(lessons);
  }

  if (req.method === "POST") {
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
      centerId: cId,
      media,
      categoryId,
      policyDocumentId,
      linkedLessonId,
      supplies,
    } = req.body;
    if (!title || !cId)
      return res.status(400).json({ error: "Title and centerId required" });

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        subCategory: subCategory || null,
        term: term || null,
        termDays: normalizeTermDaySelections(termDays),
        lessonSlot: normalizeLessonSlot(lessonSlot),
        reference: reference || null,
        centerId: cId,
        media: media || [],
        categoryId: categoryId || null,
        policyDocumentId: policyDocumentId || null,
        linkedLessonId: linkedLessonId || null,
        supplies: supplies && Array.isArray(supplies) && supplies.length
          ? {
              create: supplies.map((s) => ({
                name: s.name,
                quantity: s.quantity || 1,
                quantityType: s.quantityType === "per_student" ? "per_student" : "total",
                unit: s.unit || null,
                estimatedCost: s.estimatedCost ? parseFloat(s.estimatedCost) : null,
                category: s.category || "General",
                notes: s.notes || null,
              })),
            }
          : undefined,
      },
      include: LESSON_INCLUDE,
    });

    return res.status(201).json(lesson);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
