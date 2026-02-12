import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

function uniqStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((x) => String(x || "").trim()).filter(Boolean))];
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { childIds, itemId, completed } = req.body || {};
  const ids = uniqStrings(childIds).slice(0, 50);
  const itId = String(itemId || "").trim();
  if (!itId) return res.status(400).json({ error: "itemId is required" });
  if (!ids.length) return res.status(400).json({ error: "childIds is required" });

  const item = await prisma.milestoneChecklistItem.findUnique({
    where: { id: itId },
    include: { lessonGoal: { select: { id: true, lessonId: true, goalIndex: true } } },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });

  const children = await prisma.child.findMany({
    where: { id: { in: ids } },
    select: { id: true, centerId: true },
  });
  const foundIds = new Set(children.map((c) => c.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length) return res.status(404).json({ error: "Some children not found" });

  if (role !== "ADMIN") {
    const centerIds = [...new Set(children.map((c) => c.centerId))];
    for (const centerId of centerIds) {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }
  }

  const isCompleted = completed !== undefined ? !!completed : true;
  const completedAt = isCompleted ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    for (const child of children) {
      await tx.milestoneChecklistItemCompletion.upsert({
        where: { childId_itemId: { childId: child.id, itemId: itId } },
        create: { childId: child.id, itemId: itId, completedAt, recordedById: session.user.id },
        update: { completedAt, recordedById: session.user.id },
      });

      if (isCompleted && item.lessonGoal) {
        const lessonId = item.lessonGoal.lessonId;
        const goalIndex = item.lessonGoal.goalIndex;

        const existingProgress = await tx.progress.findUnique({
          where: { childId_lessonId_goalIndex: { childId: child.id, lessonId, goalIndex } },
        });

        const progress = existingProgress
          ? await tx.progress.update({
              where: { id: existingProgress.id },
              data: {
                status: existingProgress.status === "NOT_STARTED" ? "IN_PROGRESS" : undefined,
                achievedAt: null,
                lessonGoalId: existingProgress.lessonGoalId || item.lessonGoal.id,
              },
            })
          : await tx.progress.create({
              data: {
                childId: child.id,
                lessonId,
                goalIndex,
                status: "IN_PROGRESS",
                lessonGoalId: item.lessonGoal.id,
              },
            });

        await tx.progressEntry.create({
          data: {
            progressId: progress.id,
            status: "IN_PROGRESS",
            notes: "Auto: bulk completed milestone checklist item",
            details: { milestoneChecklistItemId: itId, bulk: true },
            recordedById: session.user.id,
          },
        });
      }
    }
  });

  return res.status(200).json({ ok: true, updated: children.length });
}

