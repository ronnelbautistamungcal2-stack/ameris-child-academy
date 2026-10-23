// A teacher's performance figures for a date range: overall grade (from the
// center's grade weights), class citizenship, milestones, evaluation,
// checklist and HR, plus training, commendations and citations. Used by the
// Teacher Performance report and Center Performance (server only).

import { getTimeOffBalanceSummary } from "@/lib/time-off";
import { checklistCompletionForRange } from "@/lib/checklistReview";
import { shiftHours, staffGradeWeightsFor, staffOverallGrade } from "@/lib/staffGrade";

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

  // ── Checklist Grade: % of due checklist items ticked on the days worked;
  // teachers count only the checklist they picked each day.
  const checklistStats = await checklistCompletionForRange(prisma, { userId: teacherId, centerId, dateFrom, dateTo });
  const totalChecklistItems = checklistStats.completedCount;
  const assignedChecklistItems = checklistStats.assignedCount;
  const checklistPct = checklistStats.pct;

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

  // ── Overall grade: the center's Staff Overall Grade weights (Center
  // Management) over evaluations, checklist, citations, commendations and HR.
  const [center, shifts] = await Promise.all([
    prisma.center.findUnique({ where: { id: centerId }, select: { staffGradeWeights: true } }),
    prisma.shiftSchedule.findMany({
      where: { userId: teacherId, centerId, date: { gte: dateFrom, lte: dateTo } },
      select: { startTime: true, endTime: true },
    }),
  ]);
  const cfg = staffGradeWeightsFor(center);
  const hoursScheduled = Math.round(shifts.reduce((sum, shift) => sum + shiftHours(shift), 0) * 10) / 10;
  const { parts: gradeParts, adjustments: gradeAdjustments, grade: overallGrade } = staffOverallGrade(
    {
      evaluationScore: mostRecentEvalScore,
      checklistPct,
      citations: citations.length,
      commendations: commendations.length,
      hoursWorked,
      hoursScheduled,
    },
    cfg,
  );
  // Kept on the report for the citizenship card; not part of the grade.
  const citizenshipNorm = citizenshipAvg != null ? Math.min(100, Math.round((citizenshipAvg / 4) * 100)) : null;
  const evalNorm = gradeParts.evaluations;

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
    hr: { hoursWorked, hoursScheduled, hrPct: gradeParts.hr, lates, absences, ptoAvailable: ptoHours, utoAvailable: utoHours },
    gradeParts,
    gradeAdjustments,
    training: { totalHours: totalTrainingHours, logs: trainingLogs },
    trainingPathways,
    commendations,
    citations,
  };
}
