import { getSession, hasAccessToCenter } from "@/lib/auth";
import { getClockedInTeacherIds } from "@/lib/compliance";
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

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const centerFilter = centerId ? { centerId } : {};

  // 1. Missed daily logging: teachers with 0 activity logs in last 24h
  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      ...(centerId
        ? { centers: { some: { centerId, role: "TEACHER" } } }
        : {}),
    },
    select: { id: true, email: true, name: true },
    take: 200,
  });

  const teacherIds = teachers.map((t) => t.id);
  const clockedInTeacherIds = await getClockedInTeacherIds({
    teacherIds,
    centerId: centerId || null,
    date: now,
  });
  const eligibleTeachers = teachers.filter((teacher) =>
    clockedInTeacherIds.has(teacher.id),
  );
  const eligibleTeacherIds = eligibleTeachers.map((teacher) => teacher.id);
  const recentLogs = eligibleTeacherIds.length
    ? await prisma.activityLog.groupBy({
        by: ["recordedById"],
        where: {
          recordedById: { in: eligibleTeacherIds },
          createdAt: { gte: last24h },
        },
        _count: true,
      })
    : [];

  const loggedTeachers = new Set(recentLogs.map((l) => l.recordedById));
  const missedLogging = eligibleTeachers.filter((t) => !loggedTeachers.has(t.id));

  // 2. Missing attendance: children with no attendance record for today
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  let missingAttendance = [];

  if (isWeekday) {
    const allChildren = await prisma.child.findMany({
      where: { ...centerFilter, classRoomId: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classRoom: { select: { id: true, name: true } },
      },
      take: 500,
    });

    const todayAttendance = await prisma.attendance.findMany({
      where: {
        ...centerFilter,
        day: todayStart,
      },
      select: { childId: true },
    });

    const checkedInIds = new Set(todayAttendance.map((a) => a.childId));
    missingAttendance = allChildren.filter((c) => !checkedInIds.has(c.id));
  }

  // 3. Overdue progress updates: children with IN_PROGRESS goals but no entry in 14 days
  const activeProgress = await prisma.progress.findMany({
    where: {
      status: "IN_PROGRESS",
      child: centerFilter.centerId ? { centerId: centerFilter.centerId } : {},
    },
    select: {
      id: true,
      childId: true,
      child: { select: { id: true, firstName: true, lastName: true } },
      lesson: { select: { title: true } },
      entries: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true },
      },
    },
  });

  const overdueProgress = activeProgress.filter((p) => {
    const lastEntry = p.entries[0];
    if (!lastEntry) return true; // Never had an entry
    return new Date(lastEntry.occurredAt) < fourteenDaysAgo;
  });

  // Deduplicate children for overdue progress
  const overdueByChild = new Map();
  for (const p of overdueProgress) {
    if (!overdueByChild.has(p.childId)) {
      overdueByChild.set(p.childId, {
        child: p.child,
        overdueGoals: [],
      });
    }
    overdueByChild.get(p.childId).overdueGoals.push({
      progressId: p.id,
      lessonTitle: p.lesson.title,
      lastEntryAt: p.entries[0]?.occurredAt || null,
    });
  }

  return res.status(200).json({
    timestamp: now.toISOString(),
    centerId: centerId || null,
    missedLogging: {
      count: missedLogging.length,
      teachers: missedLogging,
    },
    missingAttendance: {
      count: missingAttendance.length,
      isWeekday,
      children: missingAttendance,
    },
    overdueProgress: {
      count: overdueByChild.size,
      children: [...overdueByChild.values()],
    },
  });
}
