import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherChildFilter } from "@/lib/teacherScope";
import { isChildLinkedToParent } from "@/lib/child-parent-links";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { childId, from, to } = req.query;
    if (!childId) return res.status(400).json({ error: "childId is required" });

    const child = await prisma.child.findUnique({
      where: { id: childId },
      include: {
        classRoom: true,
        guardians: { select: { guardianId: true } },
      },
    });
    if (!child) return res.status(404).json({ error: "Child not found" });

    if (
      session.user.role === "PARENT" &&
      !isChildLinkedToParent(child, session.user.id)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (session.user.role === "TEACHER") {
      const tf = teacherChildFilter(session.user.id);
      const canAccess = await prisma.child.count({ where: { id: childId, ...tf } });
      if (!canAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const dateFrom = from ? new Date(from) : null;
    const dateTo = to ? new Date(to) : null;
    const dateFilter = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;
    const hasDateFilter = dateFrom || dateTo;

    const [
      progress,
      citizenshipGradeLogs,
      accomplishmentLogs,
      citizenshipLogs,
      allActivityLogs,
      attendanceData,
      behaviorPlans,
      redFlags,
    ] = await Promise.all([
      prisma.progress.findMany({
        where: { childId },
        include: {
          lesson: {
            include: {
              category: { select: { name: true } },
            },
          },
          entries: { orderBy: { occurredAt: "desc" }, take: 5 },
        },
      }),

      // Citizenship Grade: BEHAVIOR/OTHER logs with DAILY_GRADE details
      prisma.activityLog.findMany({
        where: {
          childId,
          details: { path: ["kind"], equals: "DAILY_GRADE" },
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, type: true, details: true, createdAt: true, notes: true },
        orderBy: { createdAt: "asc" },
      }),

      // Accomplishments
      prisma.activityLog.findMany({
        where: {
          childId,
          type: "ACCOMPLISHMENT",
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, type: true, details: true, notes: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),

      // Citizenship Log
      prisma.activityLog.findMany({
        where: {
          childId,
          type: "CITIZENSHIP",
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, type: true, details: true, notes: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),

      // Student Activity Log (all types) — capped at 100 recent
      prisma.activityLog.findMany({
        where: {
          childId,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: {
          id: true, type: true, details: true, notes: true, createdAt: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),

      prisma.attendance.findMany({
        where: {
          childId,
          ...(hasDateFilter ? { day: dateFilter } : {}),
        },
        select: { day: true },
      }),

      // Individual Progress Plans
      prisma.behaviorPlan.findMany({
        where: { childId, status: { in: ["ACTIVE", "CLOSED"] } },
        include: {
          goals: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { name: true } },
          closedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Red flags (open ChildFlagReviews for this child)
      prisma.childFlagReview.findMany({
        where: { childId, closedAt: null },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Progress by category
    const categoryMap = {};
    let totalGoals = 0;
    let completedGoals = 0;
    let failedGoals = 0;
    let inProgressGoals = 0;

    for (const p of progress) {
      totalGoals++;
      const cat = p.lesson?.category?.name || "Uncategorized";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, completed: 0, inProgress: 0, failed: 0, notStarted: 0, total: 0, passed: 0 };
      }
      categoryMap[cat].total++;

      if (p.status === "COMPLETED" || p.status === "PASSED") {
        completedGoals++;
        categoryMap[cat].completed++;
        categoryMap[cat].passed++;
      } else if (p.status === "FAILED") {
        failedGoals++;
        categoryMap[cat].failed++;
      } else if (p.status === "IN_PROGRESS") {
        inProgressGoals++;
        categoryMap[cat].inProgress++;
      } else {
        categoryMap[cat].notStarted++;
      }
    }

    // Compute % passed per category for milestones bar chart
    const milestonesByCategory = Object.values(categoryMap).map((c) => ({
      ...c,
      passRate: c.total > 0 ? Math.round((c.passed / c.total) * 100) : 0,
    }));

    // Active goals
    const activeGoals = progress.filter((p) =>
      ["NOT_STARTED", "IN_PROGRESS"].includes(p.status)
    );

    // Citizenship grade history for line chart
    const citizenshipGradeHistory = citizenshipGradeLogs.map((log) => ({
      id: log.id,
      date: new Date(log.createdAt).toISOString().split("T")[0],
      label: new Date(log.createdAt).toLocaleDateString(),
      score: log.details?.grade ?? log.details?.domainAvg ?? null,
      domainAvg: log.details?.domainAvg ?? null,
      domains: log.details?.domains ?? null,
      notes: log.notes || null,
    })).filter((e) => e.score !== null);

    return res.status(200).json({
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        birthDate: child.birthDate,
        classRoom: child.classRoom,
      },
      progress: {
        totalGoals,
        completed: completedGoals,
        failed: failedGoals,
        inProgress: inProgressGoals,
        completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 1000) / 10 : 0,
        byCategory: Object.values(categoryMap),
        milestonesByCategory,
        activeGoals: activeGoals.map((p) => ({
          id: p.id,
          status: p.status,
          goalIndex: p.goalIndex,
          lessonTitle: p.lesson?.title || null,
          categoryName: p.lesson?.category?.name || null,
        })),
      },
      citizenshipGrades: citizenshipGradeHistory,
      accomplishments: accomplishmentLogs,
      citizenshipLogs,
      activityLogs: allActivityLogs,
      attendance: {
        present: attendanceData.length,
        rate: null,
      },
      behaviorPlans,
      redFlags,
    });
  } catch (e) {
    console.error("analytics/child-report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
