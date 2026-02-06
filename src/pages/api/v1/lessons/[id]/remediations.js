import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });

  if (session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, lesson.centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const remediations = await prisma.lessonRemediation.findMany({
      where: { fromLessonId: id },
      include: { toLesson: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(remediations);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Only teachers/admins can edit remediations" });
    }

    const { toLessonId, reason } = req.body || {};
    if (!toLessonId) return res.status(400).json({ error: "toLessonId is required" });
    if (toLessonId === id) return res.status(400).json({ error: "Cannot recommend the same lesson" });

    const toLesson = await prisma.lesson.findUnique({ where: { id: toLessonId } });
    if (!toLesson) return res.status(404).json({ error: "Recommended lesson not found" });
    if (toLesson.centerId !== lesson.centerId) {
      return res.status(400).json({ error: "Recommended lesson must be in the same center" });
    }

    const record = await prisma.lessonRemediation.upsert({
      where: { fromLessonId_toLessonId: { fromLessonId: id, toLessonId } },
      create: { fromLessonId: id, toLessonId, reason: reason || null },
      update: { reason: reason || null },
      include: { toLesson: true },
    });

    return res.status(201).json(record);
  }

  if (req.method === "DELETE") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Only teachers/admins can edit remediations" });
    }

    const { toLessonId } = req.body || {};
    if (!toLessonId) return res.status(400).json({ error: "toLessonId is required" });

    await prisma.lessonRemediation.delete({
      where: { fromLessonId_toLessonId: { fromLessonId: id, toLessonId } },
    });

    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  res.status(405).end();
}

