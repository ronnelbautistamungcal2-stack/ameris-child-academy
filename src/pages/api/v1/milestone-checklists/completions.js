import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { childId, planId, from, to, period } = req.query || {};
    if (!childId) return res.status(400).json({ error: "childId is required" });

    try {
      const child = await prisma.child.findUnique({ where: { id: childId } });
      if (!child) return res.status(404).json({ error: "Child not found" });

      if (role !== "ADMIN") {
        const ok = await hasAccessToCenter(session.user.id, child.centerId);
        if (!ok) return res.status(403).json({ error: "Forbidden" });
      }

      const where = { childId };
      if (planId) where.item = { planId };
      if (from || to || period) {
        const fromDate = from ? parseDateOnly(from) : null;
        const toDate = to ? parseDateOnly(to) : null;
        if (from && !fromDate) return res.status(400).json({ error: "Invalid from date" });
        if (to && !toDate) return res.status(400).json({ error: "Invalid to date" });

        where.item = {
          ...(where.item || {}),
          plan: {
            ...(period ? { period } : {}),
            ...(fromDate || toDate
              ? {
                  periodStart: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lt: toDate } : {}),
                  },
                }
              : {}),
          },
        };
      }

      const completions = await prisma.milestoneChecklistItemCompletion.findMany({
        where,
        select: { itemId: true, completedAt: true, item: { select: { planId: true } } },
        take: 5000,
      });
      return res.status(200).json(completions);
    } catch (err) {
      console.error("[completions GET]", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(role)) {
      return res.status(403).json({ error: "Only teachers/admins can record completion" });
    }

    const { childId, itemId, completed } = req.body || {};
    if (!childId || !itemId) {
      return res.status(400).json({ error: "childId and itemId are required" });
    }

    const child = await prisma.child.findUnique({ where: { id: childId } });
    if (!child) return res.status(404).json({ error: "Child not found" });
    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const item = await prisma.milestoneChecklistItem.findUnique({
      where: { id: itemId },
      include: { lessonGoal: { select: { id: true, lessonId: true, goalIndex: true } } },
    });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const isCompleted = completed !== undefined ? !!completed : true;
    const completedAt = isCompleted ? new Date() : null;

    const record = await prisma.milestoneChecklistItemCompletion.upsert({
      where: { childId_itemId: { childId, itemId } },
      create: { childId, itemId, completedAt, recordedById: session.user.id },
      update: { completedAt, recordedById: session.user.id },
    });

    // If this item maps to a lesson goal, create or bump progress automatically.
    if (isCompleted && item.lessonGoal) {
      const lessonId = item.lessonGoal.lessonId;
      const goalIndex = item.lessonGoal.goalIndex;

      const existingProgress = await prisma.progress.findUnique({
        where: { childId_lessonId_goalIndex: { childId, lessonId, goalIndex } },
      });

      const progress = existingProgress
        ? await prisma.progress.update({
            where: { id: existingProgress.id },
            data: {
              status:
                existingProgress.status === "NOT_STARTED"
                  ? "IN_PROGRESS"
                  : undefined,
              achievedAt: null,
              lessonGoalId: existingProgress.lessonGoalId || item.lessonGoal.id,
            },
          })
        : await prisma.progress.create({
            data: {
              childId,
              lessonId,
              goalIndex,
              status: "IN_PROGRESS",
              lessonGoalId: item.lessonGoal.id,
            },
          });

      await prisma.progressEntry.create({
        data: {
          progressId: progress.id,
          status: "IN_PROGRESS",
          notes: "Auto: completed milestone checklist item",
          details: { milestoneChecklistItemId: itemId },
          recordedById: session.user.id,
        },
      });
    }

    return res.status(200).json(record);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
