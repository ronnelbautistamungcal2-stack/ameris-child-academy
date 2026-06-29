import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "OTHER_STAFF"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, staffId, from, to } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const resolvedStaffId = session.user.role === "OTHER_STAFF" ? session.user.id : staffId;
    if (!resolvedStaffId) return res.status(400).json({ error: "staffId is required" });

    const dateFrom = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; })();
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    // Staff info
    const staff = await prisma.user.findUnique({
      where: { id: resolvedStaffId },
      select: { id: true, name: true, email: true, hireDate: true },
    });
    if (!staff) return res.status(404).json({ error: "Staff member not found" });

    // ── Evaluation Grade ──
    const evaluations = await prisma.teacherEvaluation.findMany({
      where: { teacherId: resolvedStaffId, centerId, NOT: { overallScore: null } },
      select: { id: true, period: true, periodStart: true, overallScore: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const evalTrend = evaluations.map((e) => ({
      label: e.period || (e.periodStart
        ? new Date(e.periodStart).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        : "—"),
      score: e.overallScore,
    }));
    const mostRecentEvalScore = evaluations.length > 0 ? evaluations[evaluations.length - 1].overallScore : null;

    // ── Checklist Grade ──
    const totalChecklistCompletions = await prisma.dailyChecklistCompletion.count({
      where: {
        completedById: resolvedStaffId,
        date: { gte: dateFrom, lte: dateTo },
        item: { checklist: { centerId } },
      },
    });
    const assignedChecklistItems = await prisma.dailyChecklistItem.count({
      where: { checklist: { centerId, assignedUserId: resolvedStaffId, active: true } },
    });
    const dayRange = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)));
    const expectedItems = assignedChecklistItems * dayRange;
    const checklistPct = expectedItems > 0
      ? Math.min(100, Math.round((totalChecklistCompletions / expectedItems) * 100))
      : null;

    // ── Commendations & Citations ──
    const [commendations, citations] = await Promise.all([
      prisma.staffCommendation.findMany({
        where: { staffId: resolvedStaffId, centerId, date: { gte: dateFrom, lte: dateTo } },
        select: { id: true, text: true, date: true, createdBy: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.staffCitation.findMany({
        where: { staffId: resolvedStaffId, centerId, date: { gte: dateFrom, lte: dateTo } },
        select: { id: true, text: true, date: true, createdBy: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
    ]);

    // ── HR ──
    const staffAttendances = await prisma.staffAttendance.findMany({
      where: { userId: resolvedStaffId, centerId, date: { gte: dateFrom, lte: dateTo } },
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

    // PTO / UTO
    const timeOffEntries = await prisma.timeOffBalanceEntry.findMany({
      where: { userId: resolvedStaffId, centerId },
      select: { balanceType: true, hours: true },
    });
    let ptoHours = 0, utoHours = 0;
    for (const e of timeOffEntries) {
      if (e.balanceType === "PAID") ptoHours += e.hours;
      else if (e.balanceType === "UNPAID") utoHours += e.hours;
    }
    const usedTimeOff = await prisma.timeOffRequest.findMany({
      where: { userId: resolvedStaffId, centerId, status: "APPROVED" },
      select: { type: true, startDate: true, endDate: true },
    });
    for (const t of usedTimeOff) {
      const days = Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / (1000 * 60 * 60 * 24)) + 1);
      if (t.type === "PTO") ptoHours -= days * 8;
      else utoHours -= days * 8;
    }
    ptoHours = Math.max(0, Math.round(ptoHours * 10) / 10);
    utoHours = Math.max(0, Math.round(utoHours * 10) / 10);

    // ── Training ──
    const trainingLogs = await prisma.trainingLog.findMany({
      where: { userId: resolvedStaffId, centerId, date: { gte: dateFrom, lte: dateTo } },
      select: { id: true, topic: true, hours: true, date: true, category: true },
      orderBy: { date: "desc" },
    });
    const totalTrainingHours = Math.round(trainingLogs.reduce((s, l) => s + (l.hours || 0), 0) * 10) / 10;

    const trainingPathways = await prisma.staffAdvancement.findMany({
      where: { centerId },
      select: { id: true, title: true, category: true, steps: { select: { id: true, title: true } } },
      orderBy: { sortOrder: "asc" },
      take: 10,
    });

    // ── Grade Config + Overall Grade ──
    const gradeConfig = await prisma.otherStaffGradeConfig.findUnique({ where: { centerId } });
    const cfg = gradeConfig || { evaluationWeight: 50, checklistWeight: 50, lateDeductionPct: 1, absenceDeductionPct: 2 };

    const evalNorm = mostRecentEvalScore != null ? Math.min(100, Math.round((mostRecentEvalScore / 10) * 100)) : null;
    const checklistNorm = checklistPct;

    let overallGrade = null;
    if (evalNorm != null || checklistNorm != null) {
      const totalW = (evalNorm != null ? cfg.evaluationWeight : 0) + (checklistNorm != null ? cfg.checklistWeight : 0);
      if (totalW > 0) {
        let raw = 0;
        if (evalNorm != null) raw += (evalNorm * cfg.evaluationWeight) / totalW;
        if (checklistNorm != null) raw += (checklistNorm * cfg.checklistWeight) / totalW;
        raw -= lates * cfg.lateDeductionPct;
        raw -= absences * cfg.absenceDeductionPct;
        overallGrade = Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
      }
    }

    return res.status(200).json({
      staff: { id: staff.id, name: staff.name, email: staff.email, hireDate: staff.hireDate },
      dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      gradeConfig: cfg,
      overallGrade,
      evaluation: { mostRecentScore: mostRecentEvalScore, normalized: evalNorm, trend: evalTrend },
      checklist: { completedCount: totalChecklistCompletions, assignedCount: assignedChecklistItems, pct: checklistPct },
      commendations,
      citations,
      hr: { hoursWorked, lates, absences, ptoAvailable: ptoHours, utoAvailable: utoHours },
      training: { totalHours: totalTrainingHours, logs: trainingLogs },
      trainingPathways,
    });
  } catch (e) {
    console.error("analytics/staff-perf-report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
