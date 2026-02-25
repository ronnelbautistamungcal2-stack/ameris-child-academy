import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherChildFilter } from "@/lib/teacherScope";
import { ageGroupKeyFromBirthDate } from "@/lib/ageUtils";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, from, to, classId, ageGroup } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const dateFrom = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 90));
    const dateTo = to ? new Date(to) : new Date();

    // Build child filter
    const childWhere = { centerId };
    if (classId) childWhere.classRoomId = classId;
    if (session.user.role === "TEACHER") {
      Object.assign(childWhere, teacherChildFilter(session.user.id));
    }

    // Get children for age group filtering
    const children = await prisma.child.findMany({
      where: childWhere,
      select: { id: true, birthDate: true, classRoomId: true },
    });

    let filteredChildIds = children.map((c) => c.id);
    if (ageGroup) {
      filteredChildIds = children
        .filter((c) => ageGroupKeyFromBirthDate(c.birthDate) === ageGroup)
        .map((c) => c.id);
    }

    const progressWhere = { childId: { in: filteredChildIds } };

    const [
      progressByStatus,
      totalGoals,
      behaviorLogs,
      attendanceCount,
      totalWeekdays,
    ] = await Promise.all([
      prisma.progress.groupBy({
        by: ["status"],
        where: progressWhere,
        _count: { _all: true },
      }),
      prisma.progress.count({ where: progressWhere }),
      prisma.activityLog.findMany({
        where: {
          childId: { in: filteredChildIds },
          createdAt: { gte: dateFrom, lte: dateTo },
          details: { path: ["kind"], equals: "DAILY_GRADE" },
        },
        select: { details: true, createdAt: true, childId: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.attendance.count({
        where: {
          centerId,
          childId: { in: filteredChildIds },
          day: { gte: dateFrom, lte: dateTo },
        },
      }),
      // Expected attendance = weekdays * children
      countWeekdays(dateFrom, dateTo),
    ]);

    // Progress status distribution
    const statusDist = {};
    let completedCount = 0;
    for (const row of progressByStatus) {
      statusDist[row.status] = row._count._all;
      if (row.status === "COMPLETED" || row.status === "PASSED") {
        completedCount += row._count._all;
      }
    }
    const completionRate = totalGoals > 0 ? Math.round((completedCount / totalGoals) * 1000) / 10 : 0;

    // Behavior domain averages
    const domainSums = { cognitive: 0, social: 0, physical: 0, language: 0, creative: 0 };
    const domainCounts = { cognitive: 0, social: 0, physical: 0, language: 0, creative: 0 };

    // Group by week for trends
    const weekMap = {};

    for (const log of behaviorLogs) {
      const d = log.details;
      if (!d || !d.domains) continue;
      for (const key of Object.keys(domainSums)) {
        if (typeof d.domains[key] === "number") {
          domainSums[key] += d.domains[key];
          domainCounts[key] += 1;
        }
      }
      // Week trend
      const date = new Date(log.createdAt);
      const weekKey = getISOWeek(date);
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = { label: weekKey, _sums: {}, _counts: {} };
        for (const k of Object.keys(domainSums)) {
          weekMap[weekKey]._sums[k] = 0;
          weekMap[weekKey]._counts[k] = 0;
        }
      }
      for (const key of Object.keys(domainSums)) {
        if (typeof d.domains[key] === "number") {
          weekMap[weekKey]._sums[key] += d.domains[key];
          weekMap[weekKey]._counts[key] += 1;
        }
      }
    }

    const domainAverages = {};
    for (const key of Object.keys(domainSums)) {
      domainAverages[key] = domainCounts[key] > 0
        ? Math.round((domainSums[key] / domainCounts[key]) * 100) / 100
        : 0;
    }

    const allDomainScores = Object.values(domainAverages).filter((v) => v > 0);
    const overallAvg = allDomainScores.length > 0
      ? Math.round((allDomainScores.reduce((a, b) => a + b, 0) / allDomainScores.length) * 100) / 100
      : 0;

    // Build trend data
    const trendByWeek = Object.values(weekMap)
      .map((w) => {
        const entry = { label: w.label };
        for (const key of Object.keys(domainSums)) {
          entry[key] = w._counts[key] > 0
            ? Math.round((w._sums[key] / w._counts[key]) * 100) / 100
            : null;
        }
        return entry;
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    // Attendance rate
    const expectedAttendance = totalWeekdays * filteredChildIds.length;
    const attendanceRate = expectedAttendance > 0
      ? Math.round((attendanceCount / expectedAttendance) * 1000) / 10
      : 0;

    return res.status(200).json({
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      children: { total: filteredChildIds.length },
      progress: {
        totalGoals,
        statusDistribution: statusDist,
        completionRate,
      },
      behavior: {
        totalAssessments: behaviorLogs.length,
        avgDomainScores: domainAverages,
        overallAvg,
        trendByWeek,
      },
      attendance: {
        avgDailyRate: attendanceRate,
        totalCheckIns: attendanceCount,
      },
    });
  } catch (e) {
    console.error("analytics/overview error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function getISOWeek(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const onejan = new Date(year, 0, 1);
  const weekNum = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
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
