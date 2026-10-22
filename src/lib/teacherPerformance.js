// A teacher's performance figures for a date range: overall grade (from the
// center's grade weights), class citizenship, milestones, evaluation,
// checklist and HR, plus training, commendations and citations. Used by the
// Teacher Performance report and Center Performance (server only).

import { getTimeOffBalanceSummary } from "@/lib/time-off";

/**
 * Returns the report object, or null when the teacher does not exist.
 * dateTo should already be the end of its day.
 */
export async function teacherPerformance(prisma, { teacherId, centerId, dateFrom, dateTo }) {
  // Fetch teacher info + their classes
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      name: true,
      email: true,
      hireDate: true,
      teacherClasses: { include: { classRoom: { select: { id: true, name: true } } } },
    },
  });
  if (!teacher) return null;

  const classIds = teacher.teacherClasses.map((tc) => tc.classId);
  const classNames = teacher.teacherClasses.map((tc) => tc.classRoom?.name).filter(Boolean);

  // Children in teacher's classes
  const children = classIds.length > 0
    ? await prisma.child.findMany({
        where: { classRoomId: { in: classIds }, centerId },
        select: { id: true },
      })
    : [];
  const childIds = children.map((c) => c.id);

  // ── Class Citizenship Grade (avg citizenship score for children in class over time) ──
  const citizenshipLogs = childIds.length > 0
    ? await prisma.activityLog.findMany({
        where: {
          childId: { in: childIds },
          type: { in: ["CITIZENSHIP", "BEHAVIOR"] },
          createdAt: { gte: dateFrom, lte: dateTo },
          details: { path: ["score"], not: null },
        },
        select: { createdAt: true, details: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Group citizenship by week for chart
  const citizenshipByWeek = {};
  for (const log of citizenshipLogs) {
    const score = log.details?.score;
    if (score == null) continue;
    const d = new Date(log.createdAt);
    // Round to start of week (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
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

  const citizenshipAvg = citizenshipLogs.length > 0
    ? Math.round(
        citizenshipLogs.reduce((acc, l) => acc + (Number(l.details?.score) || 0), 0) /
        citizenshipLogs.length * 10) / 10
    : null;

  // ── Milestones Grade (avg % of steps-of-progression completed for class) ──
  const progressEntries = childIds.length > 0
    ? await prisma.progressEntry.findMany({
        where: { progress: { childId: { in: childIds } } },
        select: {
          status: true,
          progress: {
            select: {
              lesson: { select: { category: { select: { id: true, name: true } } } },
            },
          },
        },
      })
    : [];

  const milestoneCatMap = {};
  for (const p of progressEntries) {
    const catName = p.progress?.lesson?.category?.name || "Other";
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

  // ── Evaluation Grade ──
  const evaluations = await prisma.teacherEvaluation.findMany({
    where: {
      teacherId: teacherId,
      centerId,
      NOT: { overallScore: null },
      OR: [
        { periodStart: { gte: dateFrom, lte: dateTo } },
        { periodEnd: { gte: dateFrom, lte: dateTo } },
        { periodStart: null },
      ],
    },
    select: { id: true, period: true, periodStart: true, periodEnd: true, overallScore: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const evalTrend = evaluations.map((e) => ({
    label: e.period || (e.periodStart ? new Date(e.periodStart).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "—"),
    score: e.overallScore,
  }));
  const mostRecentEvalScore = evaluations.length > 0
    ? evaluations[evaluations.length - 1].overallScore
    : null;

  // ── Checklist Grade (% of daily checklist items completed by this teacher) ──
  const totalChecklistItems = await prisma.dailyChecklistCompletion.count({
    where: {
      completedById: teacherId,
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
          { assignedUserId: teacherId },
          { assignees: { some: { userId: teacherId } } },
        ],
      },
    },
  });
  // Days in range
  const dayRange = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)));
  const expectedItems = assignedChecklistItems * dayRange;
  const checklistPct = expectedItems > 0
    ? Math.min(100, Math.round((totalChecklistItems / expectedItems) * 100))
    : null;

  // ── HR: Hours Worked, Lates, Absences, PTO/UTO ──
  const staffAttendances = await prisma.staffAttendance.findMany({
    where: {
      userId: teacherId,
      centerId,
      date: { gte: dateFrom, lte: dateTo },
    },
    select: { status: true, clockIn: true, clockOut: true, lateMinutes: true },
  });

  let hoursWorked = 0;
  let lates = 0;
  let absences = 0;
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
    userId: teacherId,
    centerId,
  });
  const ptoHours = Math.max(0, timeOffSummary.paidAvailable);
  const utoHours = Math.max(0, timeOffSummary.unpaidAvailable);

  // ── Training Hours ──
  const trainingLogs = await prisma.trainingLog.findMany({
    where: {
      userId: teacherId,
      centerId,
      date: { gte: dateFrom, lte: dateTo },
    },
    select: { id: true, topic: true, hours: true, date: true, category: true },
    orderBy: { date: "desc" },
  });
  const totalTrainingHours = Math.round(trainingLogs.reduce((s, l) => s + (l.hours || 0), 0) * 10) / 10;

  // ── Training Pathway (Staff Advancement) ──
  const trainingPathways = await prisma.staffAdvancement.findMany({
    where: { centerId },
    select: { id: true, title: true, category: true, steps: { select: { id: true, title: true, stepIndex: true } } },
    orderBy: { sortOrder: "asc" },
    take: 10,
  });

  // ── Commendations & Citations ──
  const commendations = await prisma.teacherCommendation.findMany({
    where: { teacherId: teacherId, centerId, date: { gte: dateFrom, lte: dateTo } },
    select: { id: true, text: true, date: true, createdBy: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  const citations = await prisma.teacherCitation.findMany({
    where: { teacherId: teacherId, centerId, date: { gte: dateFrom, lte: dateTo } },
    select: { id: true, text: true, date: true, createdBy: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  // ── Grade Config ──
  const gradeConfig = await prisma.performanceGradeConfig.findUnique({ where: { centerId } });
  const cfg = gradeConfig || {
    citizenshipWeight: 50, evaluationWeight: 25, checklistWeight: 25,
    lateDeductionPct: 1, absenceDeductionPct: 2,
  };

  // ── Overall Performance Grade Calculation ──
  // Normalize citizenship: assume max score is 4 for CITIZENSHIP/BEHAVIOR type
  const citizenshipNorm = citizenshipAvg != null ? Math.min(100, Math.round((citizenshipAvg / 4) * 100)) : null;
  // Normalize evaluation: assume max is 10
  const evalNorm = mostRecentEvalScore != null ? Math.min(100, Math.round((mostRecentEvalScore / 10) * 100)) : null;
  // Checklist pct already 0-100
  const checklistNorm = checklistPct;

  let hasGradeData = citizenshipNorm != null || evalNorm != null || checklistNorm != null;
  let overallGrade = null;
  if (hasGradeData) {
    const totalWeight = (citizenshipNorm != null ? cfg.citizenshipWeight : 0) +
      (evalNorm != null ? cfg.evaluationWeight : 0) +
      (checklistNorm != null ? cfg.checklistWeight : 0);
    if (totalWeight > 0) {
      let raw = 0;
      if (citizenshipNorm != null) raw += (citizenshipNorm * cfg.citizenshipWeight) / totalWeight;
      if (evalNorm != null) raw += (evalNorm * cfg.evaluationWeight) / totalWeight;
      if (checklistNorm != null) raw += (checklistNorm * cfg.checklistWeight) / totalWeight;
      // Deductions
      raw -= lates * cfg.lateDeductionPct;
      raw -= absences * cfg.absenceDeductionPct;
      overallGrade = Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
    }
  }


  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      hireDate: teacher.hireDate,
      classes: classNames,
    },
    dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    gradeConfig: cfg,
    overallGrade,
    citizenship: { avg: citizenshipAvg, normalized: citizenshipNorm, trend: citizenshipTrend },
    milestones: { avgPct: milestonesAvgPct, byCategory: milestonesGrade },
    evaluation: { mostRecentScore: mostRecentEvalScore, normalized: evalNorm, trend: evalTrend, all: evaluations },
    checklist: { completedCount: totalChecklistItems, assignedCount: assignedChecklistItems, pct: checklistPct },
    hr: { hoursWorked, lates, absences, ptoAvailable: ptoHours, utoAvailable: utoHours },
    training: { totalHours: totalTrainingHours, logs: trainingLogs },
    trainingPathways,
    commendations,
    citations,
  };
}
