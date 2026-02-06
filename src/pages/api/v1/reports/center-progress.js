import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId } = req.query;
    if (!centerId || typeof centerId !== "string") {
      return res.status(400).json({ error: "centerId is required" });
    }

    const [
      childrenCount,
      lessonsCount,
      progressCount,
      progressByStatus,
      progressByGoalIndex,
      topLessonGroups,
    ] = await Promise.all([
      prisma.child.count({ where: { centerId } }),
      prisma.lesson.count({ where: { centerId } }),
      prisma.progress.count({ where: { child: { centerId } } }),
      prisma.progress.groupBy({
        by: ["status"],
        where: { child: { centerId } },
        _count: { _all: true },
        orderBy: [{ status: "asc" }],
      }),
      prisma.progress.groupBy({
        by: ["goalIndex"],
        where: { child: { centerId } },
        _count: { _all: true },
        orderBy: [{ goalIndex: "asc" }],
      }),
      prisma.progress.groupBy({
        by: ["lessonId"],
        where: {
          child: { centerId },
          status: { in: ["COMPLETED", "PASSED"] },
        },
        _count: { _all: true },
        orderBy: [{ _count: { lessonId: "desc" } }, { lessonId: "asc" }],
        take: 10,
      }),
    ]);

    const progressStatusCounts = {};
    for (const row of progressByStatus) {
      progressStatusCounts[row.status] = row._count?._all || 0;
    }

    const progressGoalIndexCounts = progressByGoalIndex.map((row) => ({
      goalIndex: row.goalIndex,
      count: row._count?._all || 0,
    }));

    const topLessonIds = topLessonGroups.map((g) => g.lessonId);
    const lessons = topLessonIds.length
      ? await prisma.lesson.findMany({
          where: { id: { in: topLessonIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleById = Object.fromEntries(lessons.map((l) => [l.id, l.title]));

    const topLessons = topLessonGroups.map((g) => ({
      lessonId: g.lessonId,
      lessonTitle: titleById[g.lessonId] || null,
      completions: g._count?._all || 0,
    }));

    return res.status(200).json({
      centerId,
      childrenCount,
      lessonsCount,
      progressCount,
      progressStatusCounts,
      progressGoalIndexCounts,
      topLessons,
    });
  } catch (e) {
    // Avoid leaking stack traces, but log for debugging.
    // eslint-disable-next-line no-console
    console.error("reports/center-progress error:", e);
    return res.status(500).json({
      error: "Internal server error",
      details:
        process.env.NODE_ENV !== "production" ? e?.message || String(e) : undefined,
    });
  }
}
