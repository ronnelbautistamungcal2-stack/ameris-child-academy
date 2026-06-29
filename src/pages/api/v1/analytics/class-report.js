import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const { classId, centerId, from, to } = req.query;
    if (!classId) return res.status(400).json({ error: "classId is required" });

    // Teachers: verify they belong to this class
    if (session.user.role === "TEACHER") {
      const assignment = await prisma.teacherClass.findFirst({
        where: { teacherId: session.user.id, classId },
      });
      if (!assignment) return res.status(403).json({ error: "Forbidden" });
    }

    const dateFrom = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; })();
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    // Classroom info + children
    const classRoom = await prisma.classRoom.findUnique({
      where: { id: classId },
      select: { id: true, name: true, ageRange: true, centerId: true },
    });
    if (!classRoom) return res.status(404).json({ error: "Classroom not found" });

    const children = await prisma.child.findMany({
      where: { classRoomId: classId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    const childIds = children.map((c) => c.id);
    const childMap = Object.fromEntries(children.map((c) => [c.id, c]));

    function childName(id) {
      const c = childMap[id];
      if (!c) return "—";
      return `${c.firstName || ""}${c.lastName ? ` ${c.lastName}` : ""}`.trim();
    }

    if (childIds.length === 0) {
      return res.status(200).json({
        classRoom,
        children: [],
        citizenshipTrend: [],
        citizenshipAvg: null,
        milestonesGrade: [],
        milestonesAvgPct: null,
        citizenshipLogs: [],
        redFlags: [],
        ippPlans: [],
        activityLogs: [],
      });
    }

    // ── Fetch all data in parallel ──────────────────────────────
    const [
      gradeLogs,
      behaviorLogs,
      progressEntries,
      redFlagRecords,
      ippPlans,
      allActivityLogs,
    ] = await Promise.all([
      // Citizenship grade logs (DAILY_GRADE entries, type OTHER, from domain scoring)
      prisma.activityLog.findMany({
        where: {
          childId: { in: childIds },
          details: { path: ["kind"], equals: "DAILY_GRADE" },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: { childId: true, details: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),

      // Citizenship behavior logs: type BEHAVIOR with level 2 or 3
      prisma.activityLog.findMany({
        where: {
          childId: { in: childIds },
          type: "BEHAVIOR",
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: {
          id: true, childId: true, type: true, details: true, notes: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      // Progress entries for milestones grade
      prisma.progress.findMany({
        where: { childId: { in: childIds } },
        select: {
          status: true, childId: true,
          lesson: { select: { category: { select: { name: true } } } },
        },
      }),

      // Red flags for class children (open only)
      prisma.childFlagReview.findMany({
        where: { childId: { in: childIds }, closedAt: null },
        orderBy: { createdAt: "desc" },
      }),

      // IPP Plans (active/open only)
      prisma.behaviorPlan.findMany({
        where: { childId: { in: childIds }, status: "ACTIVE" },
        select: {
          id: true, childId: true, title: true, startDate: true, createdAt: true,
          description: true, teacherTactics: true, parentTactics: true,
          goals: { select: { id: true, title: true, status: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // All activity logs for class daily log view
      prisma.activityLog.findMany({
        where: {
          childId: { in: childIds },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: {
          id: true, childId: true, type: true, details: true, notes: true, createdAt: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    // ── Class Citizenship Grade trend ──────────────────────────
    const citizenshipByWeek = {};
    for (const log of gradeLogs) {
      const score = log.details?.domainAvg ?? log.details?.score;
      if (score == null) continue;
      const d = new Date(log.createdAt);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d); weekStart.setDate(diff); weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.toISOString().split("T")[0];
      if (!citizenshipByWeek[key]) citizenshipByWeek[key] = { sum: 0, count: 0 };
      citizenshipByWeek[key].sum += Number(score);
      citizenshipByWeek[key].count += 1;
    }
    const citizenshipTrend = Object.entries(citizenshipByWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, { sum, count }]) => ({
        label: new Date(week).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        score: Math.round((sum / count) * 10) / 10,
      }));
    const citizenshipAvg = gradeLogs.length > 0
      ? Math.round(
          gradeLogs.reduce((acc, l) => acc + (Number(l.details?.domainAvg ?? l.details?.score) || 0), 0) /
          gradeLogs.length * 10) / 10
      : null;

    // ── Milestones by category ─────────────────────────────────
    const milestoneCatMap = {};
    for (const p of progressEntries) {
      const catName = p.lesson?.category?.name || "Other";
      if (!milestoneCatMap[catName]) milestoneCatMap[catName] = { passed: 0, total: 0 };
      milestoneCatMap[catName].total += 1;
      if (p.status === "PASSED" || p.status === "COMPLETED") milestoneCatMap[catName].passed += 1;
    }
    const milestonesGrade = Object.entries(milestoneCatMap).map(([category, { passed, total }]) => ({
      category,
      "% Passed": total > 0 ? Math.round((passed / total) * 100) : 0,
      passed,
      total,
    }));
    const milestonesAvgPct = milestonesGrade.length > 0
      ? Math.round(milestonesGrade.reduce((s, m) => s + m["% Passed"], 0) / milestonesGrade.length)
      : null;

    // ── Citizenship logs: level 2 or 3 ────────────────────────
    const citizenshipLogs = behaviorLogs
      .filter((l) => {
        const level = Number(l.details?.behaviorLevel);
        return level === 2 || level === 3;
      })
      .map((l) => ({
        id: l.id,
        childId: l.childId,
        childName: childName(l.childId),
        type: l.details?.behaviorType || "—",
        level: l.details?.behaviorLevel || "—",
        notes: l.notes || null,
        createdAt: l.createdAt,
      }));

    // ── Red flags ──────────────────────────────────────────────
    const redFlags = redFlagRecords.map((f) => ({
      id: f.id,
      childId: f.childId,
      childName: childName(f.childId),
      flagKey: f.flagKey,
      snapshot: f.snapshot,
      createdAt: f.createdAt,
    }));

    // ── IPP Plans ──────────────────────────────────────────────
    const ippPlansOut = ippPlans.map((plan) => ({
      ...plan,
      childName: childName(plan.childId),
    }));

    // ── Activity logs (group by child for Procare-style view) ──
    const activityByChild = {};
    for (const log of allActivityLogs) {
      if (!activityByChild[log.childId]) {
        activityByChild[log.childId] = {
          childId: log.childId,
          childName: childName(log.childId),
          logs: [],
        };
      }
      activityByChild[log.childId].logs.push(log);
    }
    const activityLogs = children
      .map((c) => activityByChild[c.id])
      .filter(Boolean);

    return res.status(200).json({
      classRoom,
      children,
      citizenshipTrend,
      citizenshipAvg,
      milestonesGrade,
      milestonesAvgPct,
      citizenshipLogs,
      redFlags,
      ippPlans: ippPlansOut,
      activityLogs,
    });
  } catch (e) {
    console.error("analytics/class-report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
