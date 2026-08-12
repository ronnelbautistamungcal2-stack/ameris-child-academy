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
    const { centerId, period, start, from, to, classRoomId } = req.query || {};
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const where = { centerId };
    if (period) where.period = period;
    if (classRoomId === "none") {
      where.classRoomId = null;
    } else if (classRoomId) {
      where.classRoomId = classRoomId;
    }
    if (from || to) {
      const fromDate = from ? parseDateOnly(from) : null;
      const toDate = to ? parseDateOnly(to) : null;
      if (from && !fromDate) return res.status(400).json({ error: "Invalid from date" });
      if (to && !toDate) return res.status(400).json({ error: "Invalid to date" });
      where.periodStart = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lt: toDate } : {}),
      };
    } else if (start) {
      const d = parseDateOnly(start);
      if (!d) return res.status(400).json({ error: "Invalid start date" });
      where.periodStart = d;
    }

    const plans = await prisma.milestoneChecklistPlan.findMany({
      where,
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
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: [{ periodStart: "asc" }, { title: "asc" }],
      take: 200,
    });
    return res.status(200).json(plans);
  }

  if (req.method === "POST") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can plan checklists" });
    }

    const { centerId, title, description, period, periodStart, active, items, classRoomId } = req.body || {};
    if (!centerId || !title || !period || !periodStart) {
      return res.status(400).json({ error: "centerId, title, period, and periodStart are required" });
    }
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const startDate = parseDateOnly(periodStart);
    if (!startDate) return res.status(400).json({ error: "Invalid periodStart" });

    const incomingItems = Array.isArray(items) ? items : [];
    const lessonGoalIds = [
      ...new Set(incomingItems.map((it) => it?.lessonGoalId).filter(Boolean)),
    ];
    const lessonIds = [
      ...new Set(incomingItems.map((it) => it?.lessonId).filter(Boolean)),
    ];
    const policyIds = [
      ...new Set(incomingItems.map((it) => it?.policyDocumentId).filter(Boolean)),
    ];
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
        const lessonTitle =
          lessonTitleById[goal.lessonId] || "Lesson";
        return `${lessonTitle} - Step ${goal.goalIndex}`;
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

    const createData = {
      centerId,
      classRoomId: classRoomId || null,
      title,
      description: description || null,
      period,
      periodStart: startDate,
      active: active !== undefined ? !!active : true,
      items: incomingItems.length
        ? {
            create: incomingItems
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
                priority: it.priority || null,
                dueAt: it.dueAt ? new Date(it.dueAt) : null,
                assignedToId: it.assignedToId || null,
              })),
          }
        : undefined,
    };
    const includeItems = {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          policyDocument: true,
          lesson: { include: { category: true } },
          lessonGoal: true,
        },
      },
    };

    try {
      const created = await prisma.milestoneChecklistPlan.create({
        data: createData,
        include: includeItems,
      });
      return res.status(201).json(created);
    } catch (e) {
      // Two overlapping saves for a day with no plan yet can both try to
      // create it; treat the loser as "already created" and return that row
      // instead of a hard failure.
      if (e?.code === "P2002") {
        const existing = await prisma.milestoneChecklistPlan.findFirst({
          where: { centerId, period, periodStart: startDate, title, classRoomId: classRoomId || null },
          include: includeItems,
        });
        if (existing) return res.status(200).json(existing);
      }
      throw e;
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
