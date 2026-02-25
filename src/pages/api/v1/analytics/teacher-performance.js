import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, teacherId, period, periodType = "MONTH" } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    // Teachers can only view their own
    if (session.user.role === "TEACHER" && teacherId && teacherId !== "me" && teacherId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const resolvedTeacherId = teacherId === "me" ? session.user.id : teacherId;

    const where = { centerId, periodType };
    if (period) where.period = period;
    if (resolvedTeacherId) where.teacherId = resolvedTeacherId;
    if (session.user.role === "TEACHER") where.teacherId = session.user.id;

    const snapshots = await prisma.teacherPerformanceSnapshot.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
      },
      orderBy: { compositeScore: "desc" },
    });

    const teachers = snapshots.map((s) => ({
      teacherId: s.teacherId,
      teacherName: s.teacher?.name || s.teacher?.email || "Unknown",
      period: s.period,
      periodType: s.periodType,
      compositeScore: Math.round(s.compositeScore * 10) / 10,
      breakdown: s.breakdown || {},
      metrics: {
        childrenCount: s.childrenCount,
        goalsCompleted: s.goalsCompleted,
        goalsFailed: s.goalsFailed,
        avgCompletionRate: Math.round(s.avgCompletionRate * 10) / 10,
        avgDomainScore: s.avgDomainScore ? Math.round(s.avgDomainScore * 100) / 100 : null,
        activityLogs: s.activityLogCount,
        behaviorLogs: s.behaviorLogCount,
        attendanceDays: s.attendanceDays,
      },
      computedAt: s.computedAt,
    }));

    return res.status(200).json({ teachers });
  } catch (e) {
    console.error("analytics/teacher-performance error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
