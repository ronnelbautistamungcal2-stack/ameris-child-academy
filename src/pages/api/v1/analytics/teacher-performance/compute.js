import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { centerId, period, periodType = "MONTH" } = req.body || {};
    if (!centerId || !period) {
      return res.status(400).json({ error: "centerId and period are required" });
    }

    // Parse period dates
    const { from, to } = parsePeriodDates(period, periodType);

    // Get all teachers for this center
    const teacherClasses = await prisma.teacherClass.findMany({
      where: { classRoom: { centerId } },
      include: {
        teacher: { select: { id: true, name: true } },
        classRoom: { select: { id: true } },
      },
    });

    // Group by teacher
    const teacherMap = {};
    for (const tc of teacherClasses) {
      if (!teacherMap[tc.teacherId]) {
        teacherMap[tc.teacherId] = {
          teacherId: tc.teacherId,
          teacherName: tc.teacher?.name || "",
          classIds: [],
        };
      }
      teacherMap[tc.teacherId].classIds.push(tc.classRoom.id);
    }

    const results = [];

    for (const teacher of Object.values(teacherMap)) {
      const children = await prisma.child.findMany({
        where: { centerId, classRoomId: { in: teacher.classIds } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (!childIds.length) continue;

      // 1. Child Progress Score (40%)
      const progressData = await prisma.progress.groupBy({
        by: ["status"],
        where: { childId: { in: childIds } },
        _count: { _all: true },
      });
      let totalGoals = 0;
      let completedGoals = 0;
      let failedGoals = 0;
      for (const row of progressData) {
        totalGoals += row._count._all;
        if (row.status === "COMPLETED" || row.status === "PASSED") completedGoals += row._count._all;
        if (row.status === "FAILED") failedGoals += row._count._all;
      }
      let childProgressScore = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 50;
      childProgressScore = clamp(childProgressScore, 0, 100);

      // 2. Behavior Improvement Score (25%)
      const behaviorLogs = await prisma.activityLog.findMany({
        where: {
          childId: { in: childIds },
          createdAt: { gte: from, lte: to },
          details: { path: ["kind"], equals: "DAILY_GRADE" },
        },
        select: { details: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      let behaviorImprovementScore = 50;
      const domainAvgs = [];
      for (const log of behaviorLogs) {
        if (log.details?.domainAvg != null) domainAvgs.push(log.details.domainAvg);
      }
      if (domainAvgs.length >= 2) {
        const mid = Math.floor(domainAvgs.length / 2);
        const firstHalf = domainAvgs.slice(0, mid);
        const secondHalf = domainAvgs.slice(mid);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (firstAvg > 0) {
          const ratio = (secondAvg - firstAvg) / firstAvg;
          if (ratio > 0) {
            behaviorImprovementScore = 60 + Math.min(ratio * 100, 40);
          } else {
            behaviorImprovementScore = Math.max(0, 50 + ratio * 100);
          }
        }
      }
      behaviorImprovementScore = clamp(behaviorImprovementScore, 0, 100);

      // 3. Activity Logging Score (20%)
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          recordedById: teacher.teacherId,
          createdAt: { gte: from, lte: to },
        },
        select: { createdAt: true },
      });
      const loggedDays = new Set(activityLogs.map((l) => new Date(l.createdAt).toISOString().split("T")[0]));
      const expectedDays = countWeekdays(from, to);
      const activityLoggingScore = clamp(expectedDays > 0 ? (loggedDays.size / expectedDays) * 100 : 50, 0, 100);

      // 4. Attendance Tracking Score (15%)
      const attendanceCount = await prisma.attendance.count({
        where: {
          centerId,
          childId: { in: childIds },
          day: { gte: from, lte: to },
        },
      });
      const expectedAttendance = expectedDays * childIds.length;
      const attendanceTrackingScore = clamp(
        expectedAttendance > 0 ? (attendanceCount / expectedAttendance) * 100 : 50,
        0,
        100
      );

      // Composite
      const compositeScore =
        childProgressScore * 0.4 +
        behaviorImprovementScore * 0.25 +
        activityLoggingScore * 0.2 +
        attendanceTrackingScore * 0.15;

      // Avg domain score
      const allDomainAvg = domainAvgs.length > 0
        ? domainAvgs.reduce((a, b) => a + b, 0) / domainAvgs.length
        : null;

      // Upsert snapshot
      const snapshot = await prisma.teacherPerformanceSnapshot.upsert({
        where: {
          teacherId_centerId_period_periodType: {
            teacherId: teacher.teacherId,
            centerId,
            period,
            periodType,
          },
        },
        update: {
          childrenCount: childIds.length,
          avgCompletionRate: Math.round(childProgressScore * 10) / 10,
          avgDomainScore: allDomainAvg ? Math.round(allDomainAvg * 100) / 100 : null,
          goalsCompleted: completedGoals,
          goalsFailed: failedGoals,
          activityLogCount: activityLogs.length,
          behaviorLogCount: behaviorLogs.length,
          attendanceDays: attendanceCount,
          compositeScore: Math.round(compositeScore * 10) / 10,
          breakdown: {
            childProgress: Math.round(childProgressScore * 10) / 10,
            behaviorImprovement: Math.round(behaviorImprovementScore * 10) / 10,
            activityLogging: Math.round(activityLoggingScore * 10) / 10,
            attendanceTracking: Math.round(attendanceTrackingScore * 10) / 10,
          },
          computedAt: new Date(),
        },
        create: {
          teacherId: teacher.teacherId,
          centerId,
          period,
          periodType,
          childrenCount: childIds.length,
          avgCompletionRate: Math.round(childProgressScore * 10) / 10,
          avgDomainScore: allDomainAvg ? Math.round(allDomainAvg * 100) / 100 : null,
          goalsCompleted: completedGoals,
          goalsFailed: failedGoals,
          activityLogCount: activityLogs.length,
          behaviorLogCount: behaviorLogs.length,
          attendanceDays: attendanceCount,
          compositeScore: Math.round(compositeScore * 10) / 10,
          breakdown: {
            childProgress: Math.round(childProgressScore * 10) / 10,
            behaviorImprovement: Math.round(behaviorImprovementScore * 10) / 10,
            activityLogging: Math.round(activityLoggingScore * 10) / 10,
            attendanceTracking: Math.round(attendanceTrackingScore * 10) / 10,
          },
        },
      });

      results.push(snapshot);
    }

    return res.status(200).json({ computed: results.length, snapshots: results });
  } catch (e) {
    console.error("analytics/teacher-performance/compute error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function parsePeriodDates(period, periodType) {
  if (periodType === "WEEK") {
    // e.g., "2026-W08"
    const [year, week] = period.split("-W").map(Number);
    const jan1 = new Date(year, 0, 1);
    const dayOffset = (week - 1) * 7 - jan1.getDay() + 1;
    const from = new Date(year, 0, 1 + dayOffset);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  // MONTH: e.g., "2026-02"
  const [year, month] = period.split("-").map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from, to };
}

function countWeekdays(from, to) {
  let count = 0;
  const d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
