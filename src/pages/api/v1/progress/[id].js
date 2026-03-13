import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitProgressUpdate } from "@/lib/socket";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const progress = await prisma.progress.findUnique({
      where: { id },
      include: {
        child: true,
        lesson: true,
        lessonGoal: true,
        nextGoals: true,
        entries: {
          orderBy: { occurredAt: "desc" },
          include: { recordedBy: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!progress) return res.status(404).json({ error: "Progress not found" });
    return res.status(200).json(progress);
  }

  if (req.method === "PUT") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { status, achievedAt } = req.body;

    const progress = await prisma.progress.update({
      where: { id },
      data: {
        status,
        achievedAt: achievedAt ? new Date(achievedAt) : undefined,
      },
      include: { child: true, lesson: true },
    });

    // Emit socket event
    emitProgressUpdate(progress.child.centerId, progress);

    // Auto-progression: if status is PASSED/COMPLETED, create next goal
    if (status === "PASSED" || status === "COMPLETED") {
      const existingNext = await prisma.progress.findFirst({
        where: {
          childId: progress.childId,
          lessonId: progress.lessonId,
          goalIndex: progress.goalIndex + 1,
        },
      });

      if (!existingNext) {
        const nextGoalIndex = progress.goalIndex + 1;
        const nextLessonGoal = await prisma.lessonGoal.findUnique({
          where: { lessonId_goalIndex: { lessonId: progress.lessonId, goalIndex: nextGoalIndex } },
        });

        // Only auto-advance if a LessonGoal definition exists for the next step
        if (nextLessonGoal) {
          await prisma.progress.create({
            data: {
              childId: progress.childId,
              lessonId: progress.lessonId,
              status: "NOT_STARTED",
              goalIndex: nextGoalIndex,
              previousGoalId: id,
              lessonGoalId: nextLessonGoal.id,
            },
          });
        }
      }
    }

    return res.status(200).json(progress);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only admins can delete progress records" });
    }

    await prisma.progress.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
