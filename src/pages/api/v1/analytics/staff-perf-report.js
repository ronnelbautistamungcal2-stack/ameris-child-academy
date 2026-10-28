import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checklistCompletionForRange } from "@/lib/checklistReview";
import { shiftHours, staffGradeWeightsFor, staffOverallGrade } from "@/lib/staffGrade";
import { getTimeOffBalanceSummary } from "@/lib/time-off";
import { isStaffPortalRole, STAFF_PORTAL_ROLES } from "@/lib/roles";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", ...STAFF_PORTAL_ROLES].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, staffId, from, to } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const resolvedStaffId = isStaffPortalRole(session.user.role) ? session.user.id : staffId;
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
      where: { teacherId: resolvedStaffId, centerId, NOT: { overallScore: null }, status: { not: "DRAFT" } },
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

    // ── Checklist Grade: share of due items ticked on the days worked ──
    const checklistStats = await checklistCompletionForRange(prisma, { userId: resolvedStaffId, centerId, dateFrom, dateTo });
    const totalChecklistCompletions = checklistStats.completedCount;
    const assignedChecklistItems = checklistStats.assignedCount;
    const checklistPct = checklistStats.pct;

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

    // PTO / UTO available -- shared balance math so these match the Staff
    // Management time-off panel: paid hours roll over, unpaid hours are
    // replaced by the most recently earned entry.
    const timeOffSummary = await getTimeOffBalanceSummary(prisma, {
      userId: resolvedStaffId,
      centerId,
    });
    const ptoHours = Math.max(0, timeOffSummary.paidAvailable);
    const utoHours = Math.max(0, timeOffSummary.unpaidAvailable);

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

    // ── Overall grade: the center's Staff Overall Grade weights ──
    const [center, shifts] = await Promise.all([
      prisma.center.findUnique({ where: { id: centerId }, select: { staffGradeWeights: true } }),
      prisma.shiftSchedule.findMany({
        where: { userId: resolvedStaffId, centerId, date: { gte: dateFrom, lte: dateTo } },
        select: { startTime: true, endTime: true },
      }),
    ]);
    const cfg = staffGradeWeightsFor(center);
    const hoursScheduled = Math.round(shifts.reduce((sum, shift) => sum + shiftHours(shift), 0) * 10) / 10;
    const { parts: gradeParts, adjustments: gradeAdjustments, grade: overallGrade } = staffOverallGrade(
      {
        evaluationPct: mostRecentEvalScore,
        checklistPct,
        citations: citations.length,
        commendations: commendations.length,
        hoursWorked,
        hoursScheduled,
      },
      cfg,
    );
    const evalNorm = gradeParts.evaluations;

    return res.status(200).json({
      staff: { id: staff.id, name: staff.name, email: staff.email, hireDate: staff.hireDate },
      dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      gradeConfig: cfg,
      overallGrade,
      evaluation: { mostRecentScore: mostRecentEvalScore, normalized: evalNorm, trend: evalTrend },
      checklist: { completedCount: totalChecklistCompletions, assignedCount: assignedChecklistItems, pct: checklistPct },
      commendations,
      citations,
      hr: { hoursWorked, hoursScheduled, hrPct: gradeParts.hr, lates, absences, ptoAvailable: ptoHours, utoAvailable: utoHours },
      gradeParts,
      gradeAdjustments,
      training: { totalHours: totalTrainingHours, logs: trainingLogs },
      trainingPathways,
    });
  } catch (e) {
    console.error("analytics/staff-perf-report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
