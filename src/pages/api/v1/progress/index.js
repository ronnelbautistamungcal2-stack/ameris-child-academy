import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { childId } = req.query;

  if (req.method === "GET") {
    // Get progress for a child
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      if (session.user.role === "PARENT") {
        if (!childId) {
          return res.status(400).json({ error: "childId is required" });
        }
        const child = await prisma.child.findUnique({ where: { id: childId } });
        if (!child || child.parentId !== session.user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const progress = await prisma.progress.findMany({
      where: { childId: childId || undefined },
      include: { child: true, lesson: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(progress);
  }

  if (req.method === "POST") {
    // Create progress record (teachers/admins only)
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({
          error: "Only teachers and admins can create progress records",
        });
    }

    const { childId: cId, lessonId, status, goalIndex } = req.body;

    if (!cId || !lessonId) {
      return res.status(400).json({ error: "childId and lessonId required" });
    }

    const normalizedGoalIndex = Number(goalIndex || 1);
    const lessonGoal = await prisma.lessonGoal.findUnique({
      where: { lessonId_goalIndex: { lessonId, goalIndex: normalizedGoalIndex } },
    });

    const progress = await prisma.progress.create({
      data: {
        childId: cId,
        lessonId,
        status: status || "NOT_STARTED",
        goalIndex: normalizedGoalIndex,
        lessonGoalId: lessonGoal?.id || null,
      },
      include: { child: true, lesson: true, entries: true },
    });

    return res.status(201).json(progress);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
