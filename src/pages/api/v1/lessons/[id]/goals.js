import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id: lessonId } = req.query;

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });

  if (req.method === "GET") {
    const goals = await prisma.lessonGoal.findMany({
      where: { lessonId },
      orderBy: { goalIndex: "asc" },
    });
    return res.status(200).json(goals);
  }

  if (req.method === "POST") {
    const { title, description, passingCriteria } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Auto-assign next goalIndex
    const maxGoal = await prisma.lessonGoal.findFirst({
      where: { lessonId },
      orderBy: { goalIndex: "desc" },
    });
    const nextIndex = (maxGoal?.goalIndex || 0) + 1;

    const goal = await prisma.lessonGoal.create({
      data: {
        lessonId,
        goalIndex: nextIndex,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        passingCriteria: passingCriteria || null,
      },
    });

    return res.status(201).json(goal);
  }

  if (req.method === "PUT") {
    const { goalId, title, description, passingCriteria, goalIndex } = req.body || {};
    if (!goalId) return res.status(400).json({ error: "goalId is required" });

    const existing = await prisma.lessonGoal.findUnique({ where: { id: goalId } });
    if (!existing || existing.lessonId !== lessonId) {
      return res.status(404).json({ error: "Goal not found for this lesson" });
    }

    const data = {};
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (passingCriteria !== undefined) data.passingCriteria = passingCriteria;
    if (goalIndex !== undefined && Number.isInteger(goalIndex) && goalIndex > 0) {
      data.goalIndex = goalIndex;
    }

    const updated = await prisma.lessonGoal.update({
      where: { id: goalId },
      data,
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const { goalId } = req.body || {};
    if (!goalId) return res.status(400).json({ error: "goalId is required" });

    const existing = await prisma.lessonGoal.findUnique({ where: { id: goalId } });
    if (!existing || existing.lessonId !== lessonId) {
      return res.status(404).json({ error: "Goal not found for this lesson" });
    }

    await prisma.lessonGoal.delete({ where: { id: goalId } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  res.status(405).end();
}
