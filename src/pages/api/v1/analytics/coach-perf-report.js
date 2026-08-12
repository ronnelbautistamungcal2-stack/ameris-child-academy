import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, coachId, from, to } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const resolvedCoachId = session.user.role === "COACH" ? session.user.id : coachId;
    if (!resolvedCoachId) return res.status(400).json({ error: "coachId is required" });

    const dateFrom = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; })();
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    // Coach info
    const coach = await prisma.user.findUnique({
      where: { id: resolvedCoachId },
      select: { id: true, name: true, email: true, hireDate: true },
    });
    if (!coach) return res.status(404).json({ error: "Coach not found" });

    // Teachers assigned to this coach (unique teacherIds from CoachObservation)
    const observedTeachers = await prisma.coachObservation.findMany({
      where: { coachId: resolvedCoachId, centerId },
      select: { teacherId: true, teacher: { select: { id: true, name: true, email: true } } },
      distinct: ["teacherId"],
    });
    const teacherIds = observedTeachers.map((o) => o.teacherId);
    const teacherMap = Object.fromEntries(
      observedTeachers.map((o) => [o.teacherId, o.teacher?.name || o.teacher?.email || "Unknown"])
    );

    // ── Team Performance: avg teacher composite scores from snapshots over time ──
    const teacherSnapshots = teacherIds.length > 0
      ? await prisma.teacherPerformanceSnapshot.findMany({
          where: { teacherId: { in: teacherIds }, centerId },
          select: { teacherId: true, period: true, compositeScore: true, periodType: true },
          orderBy: { period: "asc" },
        })
      : [];

    // Group by period → avg composite score
    const periodMap = {};
    for (const snap of teacherSnapshots) {
      if (!periodMap[snap.period]) periodMap[snap.period] = { sum: 0, count: 0 };
      periodMap[snap.period].sum += snap.compositeScore;
      periodMap[snap.period].count += 1;
    }
    const teamTrend = Object.entries(periodMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { sum, count }]) => ({
        label: period,
        score: Math.round((sum / count) * 10) / 10,
      }));

    // Also compute from observations (observations within date range by this coach)
    const observations = await prisma.coachObservation.findMany({
      where: {
        coachId: resolvedCoachId,
        centerId,
        date: { gte: dateFrom, lte: dateTo },
        NOT: { score: null },
      },
      select: { teacherId: true, score: true, date: true, type: true },
      orderBy: { date: "asc" },
    });

    // Weekly observation avg for team trend chart (fallback if no snapshots)
    const obsByWeek = {};
    for (const obs of observations) {
      const d = new Date(obs.date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d); weekStart.setDate(diff); weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.toISOString().split("T")[0];
      if (!obsByWeek[key]) obsByWeek[key] = { sum: 0, count: 0 };
      obsByWeek[key].sum += obs.score;
      obsByWeek[key].count += 1;
    }
    const obsTeamTrend = Object.entries(obsByWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, { sum, count }]) => ({
        label: new Date(week).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        score: Math.round((sum / count) * 10) / 10,
      }));

    const useSnapshotTrend = teamTrend.length > 0;
    const finalTeamTrend = useSnapshotTrend ? teamTrend : obsTeamTrend;
    const teamAvgScore = finalTeamTrend.length > 0
      ? Math.round(finalTeamTrend.reduce((s, p) => s + p.score, 0) / finalTeamTrend.length * 10) / 10
      : null;

    // ── Evaluation Grade (admin evaluations for this coach) ──
    const evaluations = await prisma.teacherEvaluation.findMany({
      where: {
        teacherId: resolvedCoachId,
        centerId,
        NOT: { overallScore: null },
      },
      select: { id: true, period: true, periodStart: true, overallScore: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const evalTrend = evaluations.map((e) => ({
      label: e.period || (e.periodStart
        ? new Date(e.periodStart).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        : "—"),
      score: e.overallScore,
    }));
    const mostRecentEvalScore = evaluations.length > 0
      ? evaluations[evaluations.length - 1].overallScore
      : null;

    // ── Checklist Grade (% of coach's assigned daily checklist items completed) ──
    const totalChecklistCompletions = await prisma.dailyChecklistCompletion.count({
      where: {
        completedById: resolvedCoachId,
        date: { gte: dateFrom, lte: dateTo },
        item: { checklist: { centerId } },
      },
    });
    const assignedChecklistItems = await prisma.dailyChecklistItem.count({
      where: {
        checklist: {
          centerId,
          active: true,
          OR: [
            { assignedUserId: resolvedCoachId },
            { assignees: { some: { userId: resolvedCoachId } } },
          ],
        },
      },
    });
    const dayRange = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)));
    const expectedItems = assignedChecklistItems * dayRange;
    const checklistPct = expectedItems > 0
      ? Math.min(100, Math.round((totalChecklistCompletions / expectedItems) * 100))
      : null;

    // ── Team Commendations & Citations (for teachers under this coach) ──
    const [teamCommendations, teamCitations] = await Promise.all([
      teacherIds.length > 0
        ? prisma.teacherCommendation.count({
            where: { teacherId: { in: teacherIds }, centerId, date: { gte: dateFrom, lte: dateTo } },
          })
        : 0,
      teacherIds.length > 0
        ? prisma.teacherCitation.count({
            where: { teacherId: { in: teacherIds }, centerId, date: { gte: dateFrom, lte: dateTo } },
          })
        : 0,
    ]);

    // ── HR: Hours Worked, Lates, Absences, PTO/UTO ──
    const staffAttendances = await prisma.staffAttendance.findMany({
      where: { userId: resolvedCoachId, centerId, date: { gte: dateFrom, lte: dateTo } },
      select: { status: true, clockIn: true, clockOut: true },
    });
    let hoursWorked = 0, lates = 0, absences = 0;
    for (const a of staffAttendances) {
      if (a.status === "LATE") lates++;
      if (a.status === "ABSENT") absences++;
      if (a.clockIn && a.clockOut) {
        hoursWorked += (new Date(a.clockOut) - new Date(a.clockIn)) / (1000 * 60 * 60);
      }
    }
    hoursWorked = Math.round(hoursWorked * 10) / 10;

    // PTO / UTO balances (all-time entries minus approved time-off)
    const timeOffEntries = await prisma.timeOffBalanceEntry.findMany({
      where: { userId: resolvedCoachId, centerId },
      select: { balanceType: true, hours: true },
    });
    let ptoHours = 0, utoHours = 0;
    for (const e of timeOffEntries) {
      if (e.balanceType === "PAID") ptoHours += e.hours;
      else if (e.balanceType === "UNPAID") utoHours += e.hours;
    }
    const usedTimeOff = await prisma.timeOffRequest.findMany({
      where: { userId: resolvedCoachId, centerId, status: "APPROVED" },
      select: { type: true, startDate: true, endDate: true },
    });
    for (const t of usedTimeOff) {
      const days = Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / (1000 * 60 * 60 * 24)) + 1);
      if (t.type === "PTO") ptoHours -= days * 8;
      else utoHours -= days * 8;
    }
    ptoHours = Math.max(0, Math.round(ptoHours * 10) / 10);
    utoHours = Math.max(0, Math.round(utoHours * 10) / 10);

    // ── Training Hours ──
    const trainingLogs = await prisma.trainingLog.findMany({
      where: { userId: resolvedCoachId, centerId, date: { gte: dateFrom, lte: dateTo } },
      select: { id: true, topic: true, hours: true, date: true, category: true },
      orderBy: { date: "desc" },
    });
    const totalTrainingHours = Math.round(trainingLogs.reduce((s, l) => s + (l.hours || 0), 0) * 10) / 10;

    // ── Training Pathways ──
    const trainingPathways = await prisma.staffAdvancement.findMany({
      where: { centerId },
      select: { id: true, title: true, category: true, steps: { select: { id: true, title: true } } },
      orderBy: { sortOrder: "asc" },
      take: 10,
    });

    // ── Grade Config ──
    const gradeConfig = await prisma.coachPerformanceGradeConfig.findUnique({ where: { centerId } });
    const cfg = gradeConfig || { teamPerformanceWeight: 50, evaluationWeight: 50, lateDeductionPct: 1, absenceDeductionPct: 2 };

    // ── Overall Performance Grade ──
    // team score: normalize teamAvgScore (0-100 scale, from composite 0-100 or obs 0-10)
    let teamNorm = null;
    if (teamAvgScore != null) {
      teamNorm = useSnapshotTrend
        ? Math.min(100, Math.round(teamAvgScore)) // composite is already 0-100
        : Math.min(100, Math.round((teamAvgScore / 10) * 100)); // obs score is 0-10
    }
    const evalNorm = mostRecentEvalScore != null ? Math.min(100, Math.round((mostRecentEvalScore / 10) * 100)) : null;

    let overallGrade = null;
    if (teamNorm != null || evalNorm != null) {
      const totalW = (teamNorm != null ? cfg.teamPerformanceWeight : 0) + (evalNorm != null ? cfg.evaluationWeight : 0);
      if (totalW > 0) {
        let raw = 0;
        if (teamNorm != null) raw += (teamNorm * cfg.teamPerformanceWeight) / totalW;
        if (evalNorm != null) raw += (evalNorm * cfg.evaluationWeight) / totalW;
        raw -= lates * cfg.lateDeductionPct;
        raw -= absences * cfg.absenceDeductionPct;
        overallGrade = Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
      }
    }

    return res.status(200).json({
      coach: { id: coach.id, name: coach.name, email: coach.email, hireDate: coach.hireDate },
      dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      gradeConfig: cfg,
      overallGrade,
      team: {
        teachers: observedTeachers.map((o) => ({ id: o.teacherId, name: teacherMap[o.teacherId] })),
        avgScore: teamAvgScore,
        normalized: teamNorm,
        trend: finalTeamTrend,
        usingSnapshots: useSnapshotTrend,
      },
      evaluation: { mostRecentScore: mostRecentEvalScore, normalized: evalNorm, trend: evalTrend },
      checklist: { completedCount: totalChecklistCompletions, assignedCount: assignedChecklistItems, pct: checklistPct },
      commendations: { teamTotal: teamCommendations },
      citations: { teamTotal: teamCitations },
      hr: { hoursWorked, lates, absences, ptoAvailable: ptoHours, utoAvailable: utoHours },
      training: { totalHours: totalTrainingHours, logs: trainingLogs },
      trainingPathways,
    });
  } catch (e) {
    console.error("analytics/coach-perf-report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
