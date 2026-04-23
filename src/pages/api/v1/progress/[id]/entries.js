import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitProgressUpdate } from "@/lib/socket";
import { teacherCanAccessChild } from "@/lib/teacherScope";
import { isChildLinkedToParent } from "@/lib/child-parent-links";

const ALLOWED_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "PASSED",
  "FAILED",
];

function normalizeOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (!["ADMIN", "TEACHER", "COACH", "PARENT"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const progress = await prisma.progress.findUnique({
    where: { id },
    include: {
      child: { include: { guardians: { select: { guardianId: true } } } },
      lesson: true,
    },
  });
  if (!progress) return res.status(404).json({ error: "Progress not found" });

  if (session.user.role === "PARENT") {
    if (!isChildLinkedToParent(progress.child, session.user.id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else if (session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, progress.child.centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    if (session.user.role === "TEACHER") {
      const hasClassAccess = await teacherCanAccessChild(session.user.id, progress.child);
      if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
    }
  }

  if (req.method === "GET") {
    const entries = await prisma.progressEntry.findMany({
      where: { progressId: id },
      orderBy: { occurredAt: "desc" },
      include: { recordedBy: { select: { id: true, name: true, email: true, role: true } } },
    });
    return res.status(200).json(entries);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER", "PARENT"].includes(session.user.role)) {
      return res.status(403).json({ error: "Only teachers/admins/parents can record progress" });
    }

    let { status, notes, details, media, occurredAt } = req.body || {};

    // Parents can only add notes — they cannot change the progress status
    if (session.user.role === "PARENT") {
      status = progress.status;
    }
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` });
    }

    const normalizedOccurredAt = normalizeOptionalDate(occurredAt) || new Date();

    const lessonGoal = progress.lessonGoalId
      ? null
      : await prisma.lessonGoal.findUnique({
          where: {
            lessonId_goalIndex: { lessonId: progress.lessonId, goalIndex: progress.goalIndex },
          },
        });

    const entry = await prisma.progressEntry.create({
      data: {
        progressId: id,
        status,
        notes: notes || null,
        details: details || null,
        media: Array.isArray(media) ? media : [],
        recordedById: session.user.id,
        occurredAt: normalizedOccurredAt,
      },
      include: { recordedBy: { select: { id: true, name: true, email: true, role: true } } },
    });

    const shouldAchieve = status === "PASSED" || status === "COMPLETED";
    const updated = await prisma.progress.update({
      where: { id },
      data: {
        status,
        achievedAt: shouldAchieve ? normalizedOccurredAt : null,
        lessonGoalId: lessonGoal?.id || undefined,
      },
      include: {
        child: true,
        lesson: true,
        lessonGoal: true,
        entries: {
          orderBy: { occurredAt: "desc" },
          include: { recordedBy: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });

    emitProgressUpdate(updated.child.centerId, updated);

    if (shouldAchieve) {
      const existingNext = await prisma.progress.findFirst({
        where: {
          childId: updated.childId,
          lessonId: updated.lessonId,
          goalIndex: updated.goalIndex + 1,
        },
      });

      if (!existingNext) {
        const nextGoalIndex = updated.goalIndex + 1;
        const nextLessonGoal = await prisma.lessonGoal.findUnique({
          where: { lessonId_goalIndex: { lessonId: updated.lessonId, goalIndex: nextGoalIndex } },
        });

        // Only auto-advance if a LessonGoal definition exists for the next step
        if (nextLessonGoal) {
          await prisma.progress.create({
            data: {
              childId: updated.childId,
              lessonId: updated.lessonId,
              status: "NOT_STARTED",
              goalIndex: nextGoalIndex,
              previousGoalId: updated.id,
              lessonGoalId: nextLessonGoal.id,
            },
          });
        }
      }
    }

    return res.status(201).json({ entry, progress: updated });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
