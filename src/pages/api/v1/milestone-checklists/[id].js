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

  const { id } = req.query;
  const plan = await prisma.milestoneChecklistPlan.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  if (role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, plan.centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const full = await prisma.milestoneChecklistPlan.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            policyDocument: true,
            lesson: {
              include: {
                category: true,
                remediationsFrom: { include: { toLesson: true } },
              },
            },
            lessonGoal: true,
          },
        },
      },
    });
    return res.status(200).json(full);
  }

  if (req.method === "PUT") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can edit plans" });
    }

    const { title, description, period, periodStart, active, items } = req.body || {};
    const nextPeriodStart = periodStart ? parseDateOnly(periodStart) : null;
    if (periodStart && !nextPeriodStart) return res.status(400).json({ error: "Invalid periodStart" });

    const incomingItems = Array.isArray(items) ? items : null;
    const lessonGoalIds = incomingItems
      ? [...new Set(incomingItems.map((it) => it?.lessonGoalId).filter(Boolean))]
      : [];
    const lessonIds = incomingItems
      ? [...new Set(incomingItems.map((it) => it?.lessonId).filter(Boolean))]
      : [];
    const policyIds = incomingItems
      ? [...new Set(incomingItems.map((it) => it?.policyDocumentId).filter(Boolean))]
      : [];
    const lessonIdByGoalId = lessonGoalIds.length
      ? Object.fromEntries(
          (
            await prisma.lessonGoal.findMany({
              where: { id: { in: lessonGoalIds } },
              select: { id: true, lessonId: true, goalIndex: true, title: true },
            })
          ).map((g) => [g.id, g.lessonId]),
        )
      : {};

    const lessonGoalMetaById = lessonGoalIds.length
      ? Object.fromEntries(
          (
            await prisma.lessonGoal.findMany({
              where: { id: { in: lessonGoalIds } },
              select: { id: true, lessonId: true, goalIndex: true, title: true },
            })
          ).map((g) => [g.id, g]),
        )
      : {};

    const lessonIdsForTitles = [
      ...new Set([
        ...lessonIds,
        ...Object.values(lessonGoalMetaById).map((g) => g.lessonId).filter(Boolean),
      ]),
    ];

    const lessonTitleById = lessonIdsForTitles.length
      ? Object.fromEntries(
          (
            await prisma.lesson.findMany({
              where: { id: { in: lessonIdsForTitles } },
              select: { id: true, title: true },
            })
          ).map((l) => [l.id, l.title]),
        )
      : {};

    const policyTitleById = policyIds.length
      ? Object.fromEntries(
          (
            await prisma.policyDocument.findMany({
              where: { id: { in: policyIds } },
              select: { id: true, title: true },
            })
          ).map((p) => [p.id, p.title]),
        )
      : {};

    function normalizeKind(it) {
      if (it?.kind) return it.kind;
      if (it?.lessonGoalId || it?.lessonId) return "LESSON";
      if (it?.policyDocumentId) return "POLICY";
      if (it?.url) return "VIDEO";
      return "OTHER";
    }

    function computeTitle(it) {
      const explicit = String(it?.title || "").trim();
      if (explicit) return explicit;

      const goal = it?.lessonGoalId ? lessonGoalMetaById[it.lessonGoalId] : null;
      if (goal) {
        const lessonTitle = lessonTitleById[goal.lessonId] || "Lesson";
        return `${lessonTitle} — Step ${goal.goalIndex}`;
      }

      const lessonTitle = it?.lessonId ? lessonTitleById[it.lessonId] : null;
      if (lessonTitle) return lessonTitle;

      const policyTitle = it?.policyDocumentId
        ? policyTitleById[it.policyDocumentId]
        : null;
      if (policyTitle) return policyTitle;

      const url = String(it?.url || "").trim();
      if (url) return url;

      return "";
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.milestoneChecklistPlan.update({
        where: { id },
        data: {
          title: title !== undefined ? title : undefined,
          description: description !== undefined ? description : undefined,
          period: period !== undefined ? period : undefined,
          periodStart: nextPeriodStart || undefined,
          active: active !== undefined ? !!active : undefined,
        },
      });

      if (incomingItems) {
        await tx.milestoneChecklistItem.deleteMany({ where: { planId: id } });
        await tx.milestoneChecklistItem.createMany({
          data: incomingItems
            .filter(
              (it) =>
                it &&
                (it.title ||
                  it.lessonId ||
                  it.lessonGoalId ||
                  it.policyDocumentId ||
                  it.url),
            )
            .map((it, idx) => ({
              planId: id,
              title: computeTitle(it),
              sortOrder: Number.isFinite(Number(it.sortOrder)) ? Number(it.sortOrder) : idx,
              kind: normalizeKind(it),
              url: it.url || null,
              notes: it.notes || null,
              policyDocumentId: it.policyDocumentId || null,
              lessonId:
                it.lessonId ||
                lessonIdByGoalId[it.lessonGoalId] ||
                (it.lessonGoalId ? lessonGoalMetaById[it.lessonGoalId]?.lessonId : null) ||
                null,
              lessonGoalId: it.lessonGoalId || null,
            })),
        });
      }

      return p;
    });

    const full = await prisma.milestoneChecklistPlan.findUnique({
      where: { id: updated.id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            policyDocument: true,
            lesson: { include: { category: true } },
            lessonGoal: true,
          },
        },
      },
    });
    return res.status(200).json(full);
  }

  if (req.method === "DELETE") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete plans" });
    }
    await prisma.milestoneChecklistPlan.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
