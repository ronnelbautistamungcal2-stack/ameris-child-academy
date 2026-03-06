import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { centerId } = req.query;
  if (centerId && role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  const centerFilter = centerId ? { centerId } : {};
  const now = new Date();

  // 1. Teachers with their classroom assignments
  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      ...(centerId
        ? { centers: { some: { centerId, role: "TEACHER" } } }
        : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      pictureUrl: true,
      teacherClasses: {
        select: {
          classRoom: {
            select: { id: true, name: true, ageRange: true },
          },
        },
      },
    },
    take: 200,
  });

  // 2. Checklist status per class — active plans with completion stats
  const plans = await prisma.milestoneChecklistPlan.findMany({
    where: { ...centerFilter, active: true },
    select: {
      id: true,
      title: true,
      period: true,
      periodStart: true,
      items: {
        select: {
          id: true,
          title: true,
          priority: true,
          dueAt: true,
          assignedToId: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          completions: {
            select: { id: true, completedAt: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { periodStart: "desc" },
    take: 20,
  });

  // Compute checklist summary
  const checklistSummary = plans.map((plan) => {
    const totalItems = plan.items.length;
    const completedItems = plan.items.filter(
      (item) => item.completions.length > 0 && item.completions.every((c) => c.completedAt),
    ).length;
    return {
      id: plan.id,
      title: plan.title,
      period: plan.period,
      periodStart: plan.periodStart,
      totalItems,
      completedItems,
      items: plan.items.map((item) => ({
        id: item.id,
        title: item.title,
        priority: item.priority,
        dueAt: item.dueAt,
        assignedTo: item.assignedTo,
        completionCount: item.completions.filter((c) => c.completedAt).length,
        totalCompletions: item.completions.length,
      })),
    };
  });

  // 3. Overdue checklist alarms — items with dueAt in the past and incomplete
  const overdueItems = await prisma.milestoneChecklistItem.findMany({
    where: {
      dueAt: { lt: now },
      plan: { ...centerFilter, active: true },
      completions: { none: { completedAt: { not: null } } },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueAt: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      plan: { select: { id: true, title: true } },
    },
    orderBy: { dueAt: "asc" },
    take: 50,
  });

  // 4. Open follow-ups count
  const followUpCounts = await prisma.coachFollowUp.groupBy({
    by: ["type"],
    where: {
      ...centerFilter,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    _count: true,
  });

  // 5. Recent observations
  const recentObservations = await prisma.coachObservation.findMany({
    where: centerFilter,
    select: {
      id: true,
      type: true,
      date: true,
      teacher: { select: { id: true, name: true, email: true } },
      classRoom: { select: { id: true, name: true } },
      score: true,
    },
    orderBy: { date: "desc" },
    take: 5,
  });

  return res.status(200).json({
    teachers: teachers.map((t) => ({
      id: t.id,
      email: t.email,
      name: t.name,
      pictureUrl: t.pictureUrl,
      classrooms: t.teacherClasses.map((tc) => tc.classRoom),
    })),
    checklistSummary,
    overdueAlarms: overdueItems,
    followUpCounts: followUpCounts.reduce((acc, fc) => {
      acc[fc.type] = fc._count;
      return acc;
    }, {}),
    recentObservations,
  });
}
