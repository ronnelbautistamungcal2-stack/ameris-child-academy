import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createApiHandler,
  forbidden,
  unauthorized,
} from "@/lib/api-error";
import { assertSubscriptionFeature } from "@/lib/subscriptions";

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date = new Date()) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const output = new Date(date);
  output.setDate(date.getDate() - diff);
  output.setHours(0, 0, 0, 0);
  return output;
}

function daysAgo(days) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value;
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "OTHER_STAFF"].includes(role)) {
    throw forbidden();
  }

  const userId = session.user.id;
  const memberships = role === "ADMIN"
    ? []
    : await prisma.centerUser.findMany({
        where: { userId },
        include: { center: { include: { subscription: true } } },
      });

  if (role !== "ADMIN") {
    const enabledCenters = memberships.filter((membership) => {
      try {
        assertSubscriptionFeature(membership.center.subscription, "teacherMetrics", {
          centerId: membership.centerId,
        });
        return true;
      } catch {
        return false;
      }
    });

    if (!enabledCenters.length) {
      return res.status(402).json({
        ok: false,
        message: "Teacher metrics are not enabled for your centers",
        error: {
          code: "FEATURE_DISABLED",
          message: "Teacher metrics are not enabled for your centers",
        },
      });
    }
  }

  const [activityCounts, teacherClasses, trainingLogs, evaluationRows, attendanceRows] =
    await Promise.all([
      prisma.activityLog.findMany({
        where: {
          recordedById: userId,
          createdAt: { gte: daysAgo(30) },
        },
        select: { createdAt: true, type: true },
      }),
      prisma.teacherClass.findMany({
        where: role === "ADMIN" ? undefined : { teacherId: userId },
        select: {
          classId: true,
          classRoom: { select: { id: true, centerId: true } },
        },
      }),
      prisma.trainingLog.findMany({
        where: {
          userId,
          date: { gte: daysAgo(365) },
        },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.teacherEvaluation.findMany({
        where: { teacherId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.staffAttendance.findMany({
        where: {
          userId,
          date: { gte: daysAgo(30) },
        },
        orderBy: { date: "desc" },
        take: 60,
      }),
    ]);

  const classIds = teacherClasses.map((row) => row.classId);
  const centerIds =
    role === "ADMIN"
      ? []
      : [...new Set(memberships.map((membership) => membership.centerId))];
  const scopedClassIds =
    role === "ADMIN"
      ? []
      : [...new Set(teacherClasses.map((row) => row.classId).filter(Boolean))];

  const [childrenCount, progressRows] = await Promise.all([
    role === "ADMIN"
      ? prisma.child.count()
      : role === "TEACHER" && scopedClassIds.length
        ? prisma.child.count({ where: { classRoomId: { in: scopedClassIds } } })
        : 0,
    role === "ADMIN"
      ? prisma.progress.findMany({
          where: { createdAt: { gte: daysAgo(90) } },
          select: { status: true, updatedAt: true, childId: true },
          take: 500,
        })
      : role === "TEACHER" && scopedClassIds.length
        ? prisma.progress.findMany({
            where: {
              child: { classRoomId: { in: scopedClassIds } },
              createdAt: { gte: daysAgo(90) },
            },
            select: { status: true, updatedAt: true, childId: true },
            take: 500,
          })
        : [],
  ]);

  const todayBoundary = startOfDay();
  const weekBoundary = startOfWeek();
  const last30Boundary = daysAgo(30);
  const activeDaysLast30 = new Set(
    activityCounts.map((row) => new Date(row.createdAt).toISOString().slice(0, 10)),
  );
  const activeDaysLast7 = new Set(
    activityCounts
      .filter((row) => row.createdAt >= daysAgo(7))
      .map((row) => new Date(row.createdAt).toISOString().slice(0, 10)),
  );

  const activitiesToday = activityCounts.filter((row) => row.createdAt >= todayBoundary).length;
  const activitiesWeek = activityCounts.filter((row) => row.createdAt >= weekBoundary).length;
  const activitiesLast30 = activityCounts.filter((row) => row.createdAt >= last30Boundary).length;

  const activityTypeCounts = activityCounts.reduce((acc, row) => {
    acc[row.type] = (acc[row.type] || 0) + 1;
    return acc;
  }, {});

  const progressSummary = progressRows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { total: 0, NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, PASSED: 0, FAILED: 0 },
  );
  const completedCount = progressSummary.COMPLETED + progressSummary.PASSED;
  const completionRate = progressSummary.total ? round((completedCount / progressSummary.total) * 100) : 0;

  const trainingByCategory = trainingLogs.reduce((acc, row) => {
    const key = row.category || "Other";
    acc[key] = round((acc[key] || 0) + row.hours);
    return acc;
  }, {});
  const trainingHours = round(trainingLogs.reduce((sum, row) => sum + row.hours, 0));
  const recentTraining = trainingLogs.slice(0, 5).map((row) => ({
    id: row.id,
    topic: row.topic,
    category: row.category,
    hours: row.hours,
    date: row.date,
  }));

  const evaluationScores = evaluationRows
    .map((row) => row.overallScore)
    .filter((value) => Number.isFinite(value));
  const latestEvaluation = evaluationRows[0] || null;
  const averageEvaluationScore = evaluationScores.length
    ? round(evaluationScores.reduce((sum, value) => sum + value, 0) / evaluationScores.length)
    : null;

  const attendanceSummary = attendanceRows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      if (row.lateMinutes) {
        acc.totalLateMinutes += row.lateMinutes;
      }
      return acc;
    },
    { total: 0, PRESENT: 0, LATE: 0, ABSENT: 0, HALF_DAY: 0, totalLateMinutes: 0 },
  );

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    activities: {
      today: activitiesToday,
      week: activitiesWeek,
      last30Days: activitiesLast30,
      activeDaysLast7: activeDaysLast7.size,
      activeDaysLast30: activeDaysLast30.size,
      averagePerActiveDay: activeDaysLast30.size ? round(activitiesLast30 / activeDaysLast30.size) : 0,
      byType: activityTypeCounts,
    },
    access: {
      centers: role === "ADMIN" ? await prisma.center.count() : centerIds.length,
      classes: role === "ADMIN" ? await prisma.classRoom.count() : classIds.length,
      children: childrenCount,
    },
    progress: {
      totalGoals: progressSummary.total,
      inProgress: progressSummary.IN_PROGRESS,
      completed: progressSummary.COMPLETED,
      passed: progressSummary.PASSED,
      failed: progressSummary.FAILED,
      completionRate,
    },
    training: {
      totalHours: trainingHours,
      entries: trainingLogs.length,
      lastCompletedAt: trainingLogs[0]?.date || null,
      byCategory: trainingByCategory,
      recent: recentTraining,
    },
    evaluations: {
      count: evaluationRows.length,
      averageScore: averageEvaluationScore,
      latest: latestEvaluation
        ? {
            id: latestEvaluation.id,
            period: latestEvaluation.period,
            status: latestEvaluation.status,
            overallScore: latestEvaluation.overallScore,
            teacherAcknowledgedAt: latestEvaluation.teacherAcknowledgedAt,
            createdAt: latestEvaluation.createdAt,
          }
        : null,
    },
    attendance: {
      totalRecords: attendanceSummary.total,
      present: attendanceSummary.PRESENT,
      late: attendanceSummary.LATE,
      absent: attendanceSummary.ABSENT,
      halfDay: attendanceSummary.HALF_DAY,
      totalLateMinutes: attendanceSummary.totalLateMinutes,
    },
  });
}, { methods: ["GET"], logLabel: "metrics/me error:" });
