import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createApiHandler,
  forbidden,
  unauthorized,
} from "@/lib/api-error";
import { optionalDate, optionalString } from "@/lib/validation";
import { assertSubscriptionFeature } from "@/lib/subscriptions";

function buildWeekKey(dateValue) {
  const date = new Date(dateValue);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function buildMonthKey(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return null;
  return Math.round((numeric.reduce((sum, value) => sum + value, 0) / numeric.length) * 100) / 100;
}

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (!["ADMIN", "COACH"].includes(session.user.role)) throw forbidden();

  const centerId = optionalString(req.query, "centerId");
  const teacherId = optionalString(req.query, "teacherId");
  const dateFrom = optionalDate(req.query, "dateFrom") || (() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date;
  })();
  const dateTo = optionalDate(req.query, "dateTo") || new Date();

  if (session.user.role === "COACH" && !centerId) {
    return res.status(400).json({
      ok: false,
      message: "centerId is required",
      error: {
        code: "BAD_REQUEST",
        message: "centerId is required",
      },
    });
  }

  if (centerId && session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) throw forbidden();
  }

  if (centerId) {
    const center = await prisma.center.findUnique({
      where: { id: centerId },
      include: { subscription: true },
    });
    if (center?.subscription) {
      assertSubscriptionFeature(center.subscription, "coachReports", { centerId });
    }
  }

  const teacherWhere = {
    role: "TEACHER",
    ...(teacherId ? { id: teacherId } : {}),
    ...(centerId ? { centers: { some: { centerId, role: "TEACHER" } } } : {}),
  };

  const teachers = await prisma.user.findMany({
    where: teacherWhere,
    select: {
      id: true,
      name: true,
      email: true,
      pictureUrl: true,
      teacherClasses: {
        select: {
          classRoom: { select: { id: true, name: true } },
        },
      },
    },
    take: 100,
    orderBy: { name: "asc" },
  });

  const teacherIds = teachers.map((teacher) => teacher.id);
  if (!teacherIds.length) {
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      summary: {
        teachers: 0,
        observations: 0,
        avgObservationScore: null,
        openFollowUps: 0,
        overdueFollowUps: 0,
        completedFollowUps: 0,
        trainingHours: 0,
      },
      teachersReport: [],
      trends: {
        observationsByWeek: [],
        followUpsByStatus: [],
        trainingByMonth: [],
      },
      watchlist: {
        overdueFollowUps: [],
        lowScoringObservations: [],
      },
    });
  }

  const [observations, followUps, trainingLogs, evaluations, activityLogs] = await Promise.all([
    prisma.coachObservation.findMany({
      where: {
        teacherId: { in: teacherIds },
        ...(centerId ? { centerId } : {}),
        date: { gte: dateFrom, lte: dateTo },
      },
      select: {
        id: true,
        teacherId: true,
        date: true,
        score: true,
        type: true,
      },
      orderBy: { date: "desc" },
      take: 1000,
    }),
    prisma.coachFollowUp.findMany({
      where: {
        ...(centerId ? { centerId } : {}),
        OR: [
          { assignedToId: { in: teacherIds } },
          { createdById: session.user.id },
        ],
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        id: true,
        assignedToId: true,
        status: true,
        priority: true,
        title: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: { dueDate: "asc" },
      take: 1000,
    }),
    prisma.trainingLog.findMany({
      where: {
        userId: { in: teacherIds },
        ...(centerId ? { centerId } : {}),
        date: { gte: dateFrom, lte: dateTo },
      },
      select: {
        id: true,
        userId: true,
        topic: true,
        category: true,
        hours: true,
        date: true,
      },
      orderBy: { date: "desc" },
      take: 1000,
    }),
    prisma.teacherEvaluation.findMany({
      where: {
        teacherId: { in: teacherIds },
        ...(centerId ? { centerId } : {}),
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        id: true,
        teacherId: true,
        period: true,
        status: true,
        overallScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.activityLog.findMany({
      where: {
        recordedById: { in: teacherIds },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        recordedById: true,
        createdAt: true,
        type: true,
      },
      take: 5000,
    }),
  ]);

  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const today = startOfDay(now);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const observationWeekMap = new Map();
  const followUpStatusMap = new Map();
  const trainingMonthMap = new Map();

  for (const row of observations) {
    const key = buildWeekKey(row.date);
    observationWeekMap.set(key, (observationWeekMap.get(key) || 0) + 1);
  }
  for (const row of followUps) {
    followUpStatusMap.set(row.status, (followUpStatusMap.get(row.status) || 0) + 1);
  }
  for (const row of trainingLogs) {
    const key = buildMonthKey(row.date);
    trainingMonthMap.set(key, Math.round(((trainingMonthMap.get(key) || 0) + row.hours) * 100) / 100);
  }

  const teachersReport = teachers.map((teacher) => {
    const teacherObservations = observations.filter((row) => row.teacherId === teacher.id);
    const teacherFollowUps = followUps.filter((row) => row.assignedToId === teacher.id);
    const teacherTraining = trainingLogs.filter((row) => row.userId === teacher.id);
    const teacherEvaluations = evaluations.filter((row) => row.teacherId === teacher.id);
    const teacherLogs = activityLogs.filter((row) => row.recordedById === teacher.id);

    const latestEvaluation = teacherEvaluations[0] || null;
    const overdueFollowUps = teacherFollowUps.filter(
      (row) =>
        row.status !== "COMPLETED" &&
        row.status !== "CANCELLED" &&
        row.dueDate &&
        new Date(row.dueDate) < now,
    );

    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      pictureUrl: teacher.pictureUrl,
      classrooms: teacher.teacherClasses.map((row) => row.classRoom).filter(Boolean),
      observationCount: teacherObservations.length,
      avgObservationScore: average(teacherObservations.map((row) => row.score)),
      openFollowUps: teacherFollowUps.filter((row) => ["OPEN", "IN_PROGRESS"].includes(row.status)).length,
      overdueFollowUps: overdueFollowUps.length,
      completedFollowUps: teacherFollowUps.filter((row) => row.status === "COMPLETED").length,
      trainingHours: Math.round(teacherTraining.reduce((sum, row) => sum + row.hours, 0) * 100) / 100,
      lastTrainingAt: teacherTraining[0]?.date || null,
      latestEvaluation: latestEvaluation
        ? {
            period: latestEvaluation.period,
            status: latestEvaluation.status,
            overallScore: latestEvaluation.overallScore,
            createdAt: latestEvaluation.createdAt,
          }
        : null,
      logsLast24Hours: teacherLogs.filter((row) => row.createdAt >= last24Hours).length,
      logsLast7Days: teacherLogs.filter((row) => row.createdAt >= last7Days).length,
    };
  });

  const lowScoringObservations = observations
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      teacherId: row.teacherId,
      teacherName: teachers.find((teacher) => teacher.id === row.teacherId)?.name || "Unknown",
      score: row.score,
      type: row.type,
      date: row.date,
    }));

  const overdueFollowUps = followUps
    .filter(
      (row) =>
        row.status !== "COMPLETED" &&
        row.status !== "CANCELLED" &&
        row.dueDate &&
        new Date(row.dueDate) < now,
    )
    .slice(0, 8);

  const activityByType = activityLogs.reduce((acc, row) => {
    acc[row.type] = (acc[row.type] || 0) + 1;
    return acc;
  }, {});

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    summary: {
      teachers: teachers.length,
      observations: observations.length,
      avgObservationScore: average(observations.map((row) => row.score)),
      openFollowUps: followUps.filter((row) => ["OPEN", "IN_PROGRESS"].includes(row.status)).length,
      overdueFollowUps: overdueFollowUps.length,
      completedFollowUps: followUps.filter((row) => row.status === "COMPLETED").length,
      trainingHours: Math.round(trainingLogs.reduce((sum, row) => sum + row.hours, 0) * 100) / 100,
      activitiesToday: activityLogs.filter((row) => row.createdAt >= today).length,
      activitiesWeek: activityLogs.filter((row) => row.createdAt >= last7Days).length,
      activitiesMonth: activityLogs.filter((row) => row.createdAt >= last30Days).length,
      activityByType,
    },
    teachersReport,
    trends: {
      observationsByWeek: [...observationWeekMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, count]) => ({ week, count })),
      followUpsByStatus: [...followUpStatusMap.entries()].map(([status, count]) => ({
        status,
        count,
      })),
      trainingByMonth: [...trainingMonthMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, hours]) => ({ month, hours })),
    },
    watchlist: {
      overdueFollowUps,
      lowScoringObservations,
    },
  });
}, { methods: ["GET"], logLabel: "coach/reports error:" });
