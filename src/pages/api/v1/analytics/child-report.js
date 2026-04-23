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

    // Access check
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

    const [progress, behaviorLogs, attendanceData, behaviorPlans] = await Promise.all([
      prisma.progress.findMany({
        where: { childId },
        include: {
          lesson: { include: { category: { select: { name: true } } } },
          entries: { orderBy: { occurredAt: "desc" }, take: 5 },
        },
      }),
      prisma.activityLog.findMany({
        where: {
          childId,
          details: { path: ["kind"], equals: "DAILY_GRADE" },
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { details: true, createdAt: true, notes: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.attendance.findMany({
        where: {
          childId,
          ...(hasDateFilter ? { day: dateFilter } : {}),
        },
        select: { day: true },
      }),
      prisma.behaviorPlan.findMany({
        where: { childId, status: "ACTIVE" },
        include: {
          goals: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { name: true } },
        },
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
      if (!categoryMap[cat]) categoryMap[cat] = { category: cat, completed: 0, inProgress: 0, failed: 0, notStarted: 0, total: 0 };
      categoryMap[cat].total++;

      if (p.status === "COMPLETED" || p.status === "PASSED") {
        completedGoals++;
        categoryMap[cat].completed++;
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

    // Behavior domain history and trend
    const behaviorHistory = [];
    const domainTrend = { cognitive: [], social: [], physical: [], language: [], creative: [] };

    for (const log of behaviorLogs) {
      const d = log.details;
      if (!d || !d.domains) continue;
      const entry = {
        date: new Date(log.createdAt).toISOString().split("T")[0],
        domains: d.domains,
        avg: d.domainAvg ?? null,
        notes: log.notes || null,
      };
      behaviorHistory.push(entry);
      for (const key of Object.keys(domainTrend)) {
        if (typeof d.domains[key] === "number") {
          domainTrend[key].push(d.domains[key]);
        }
      }
    }

    // Latest scores
    const latestScores = {};
    if (behaviorHistory.length) {
      const last = behaviorHistory[behaviorHistory.length - 1];
      Object.assign(latestScores, last.domains);
    }

    // Domain averages
    const domainAverages = {};
    for (const [key, vals] of Object.entries(domainTrend)) {
      domainAverages[key] = vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : 0;
    }

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
      },
      behavior: {
        latestScores,
        domainAverages,
        history: behaviorHistory,
        domainTrend: Object.fromEntries(
          Object.entries(domainTrend).map(([k, v]) => [k, v.slice(-20)])
        ),
      },
      attendance: {
        present: attendanceData.length,
        rate: null, // needs expected days context
      },
      behaviorPlans,
    });
  } catch (e) {
    console.error("analytics/child-report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
