import { getSession } from "@/lib/auth";
import { CURRENT_IPP_STATUSES } from "@/lib/ipp";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES, hasAnyRole, roleLabel } from "@/lib/roles";
import { childStatus, levelForStatus } from "@/lib/sop";
import { teacherPerformance } from "@/lib/teacherPerformance";

// Center Performance Overview (client mockups 2026-10-02) for one center and
// date range: a row per staff member (the Staff Performance Overview) and per
// child (the Student Performance Overview). The page builds the overview bars
// from these rows, so the bars and the tables always agree. Admin only.

const STAFF_ROLES = EMPLOYEE_ROLES.filter((r) => r !== "ADMIN");
const LOG_DAYS = 400;

function parseDay(value, fallback) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : fallback;
}

function dayKey(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftHours(shift) {
  const [sh, sm] = String(shift.startTime).split(":").map(Number);
  const [eh, em] = String(shift.endTime).split(":").map(Number);
  const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

/** GET /api/v1/reports/center-performance?centerId=&from=YYYY-MM-DD&to=YYYY-MM-DD */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    if (!hasAnyRole(session.user, ["ADMIN"])) return res.status(403).json({ error: "Forbidden" });

    const centers = await prisma.center.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    const requested = req.query.centerId ? String(req.query.centerId) : "";
    const center = requested ? centers.find((c) => c.id === requested) : centers.find((c) => c.name === "Demo Center") || centers[0];
    if (!center) return res.status(requested ? 404 : 200).json(requested ? { error: "Center not found" } : { centers: [], staff: [], students: [] });

    const today = new Date();
    const dateTo = parseDay(req.query.to, today);
    const dateFrom = parseDay(req.query.from, new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate() - 30));
    if (dateFrom > dateTo) return res.status(400).json({ error: "The start date must be before the end date" });
    const endOfTo = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999);
    const spanDays = Math.round((dateTo - dateFrom) / 86400000) + 1;
    const priorTo = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate() - 1, 23, 59, 59, 999);
    const priorFrom = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate() - spanDays);

    // ---- Staff ------------------------------------------------------------
    const members = await prisma.user.findMany({
      where: {
        centers: { some: { centerId: center.id } },
        OR: [{ role: { in: STAFF_ROLES } }, { roles: { hasSome: STAFF_ROLES } }],
      },
      select: { id: true, name: true, email: true, role: true, roles: true },
      orderBy: { name: "asc" },
    });
    const memberIds = members.map((m) => m.id);
    const [shifts, attendance, timeOff] = await Promise.all([
      prisma.shiftSchedule.findMany({ where: { centerId: center.id, userId: { in: memberIds }, date: { gte: dateFrom, lte: endOfTo } }, orderBy: { date: "desc" } }),
      prisma.staffAttendance.findMany({ where: { centerId: center.id, userId: { in: memberIds }, date: { gte: dateFrom, lte: endOfTo }, status: "ABSENT" }, select: { userId: true, date: true } }),
      prisma.timeOffRequest.findMany({ where: { centerId: center.id, userId: { in: memberIds }, status: "APPROVED", startDate: { lte: endOfTo }, endDate: { gte: dateFrom } }, select: { userId: true, startDate: true, endDate: true } }),
    ]);

    const staff = [];
    for (const m of members) {
      const [current, prior] = await Promise.all([
        teacherPerformance(prisma, { teacherId: m.id, centerId: center.id, dateFrom, dateTo: endOfTo }),
        teacherPerformance(prisma, { teacherId: m.id, centerId: center.id, dateFrom: priorFrom, dateTo: priorTo }),
      ]);
      const mine = shifts.filter((s) => s.userId === m.id);
      const scheduled = mine.reduce((sum, s) => sum + shiftHours(s), 0);
      // Hours absent: scheduled hours on days marked absent or covered by approved time off.
      const absentDays = new Set(attendance.filter((a) => a.userId === m.id).map((a) => dayKey(a.date)));
      for (const t of timeOff.filter((x) => x.userId === m.id)) {
        for (let d = new Date(t.startDate); d <= t.endDate; d.setDate(d.getDate() + 1)) absentDays.add(dayKey(d));
      }
      const hoursAbsence = mine.filter((s) => absentDays.has(dayKey(s.date))).reduce((sum, s) => sum + shiftHours(s), 0);
      const worked = current?.hr?.hoursWorked ?? 0;
      const role = (m.roles?.length ? m.roles : [m.role]).find((r) => STAFF_ROLES.includes(r)) || m.role;
      staff.push({
        id: m.id,
        name: m.name || m.email,
        role,
        position: mine[0]?.position || roleLabel(role),
        currentGrade: current?.overallGrade ?? null,
        priorGrade: prior?.overallGrade ?? null,
        evaluationPct: current?.evaluation?.normalized ?? null,
        checklistPct: current?.checklist?.pct ?? null,
        sopPct: current?.milestones?.avgPct ?? null,
        citizenshipPct: current?.citizenship?.normalized ?? null,
        commendations: current?.commendations?.length ?? 0,
        citations: current?.citations?.length ?? 0,
        hoursWorked: round1(worked),
        hoursScheduled: round1(scheduled),
        hoursAbsence: round1(hoursAbsence),
        lates: current?.hr?.lates ?? 0,
        hrPct: scheduled > 0 ? Math.min(100, Math.round((worked / scheduled) * 100)) : null,
      });
    }

    // ---- Students -----------------------------------------------------------
    const children = await prisma.child.findMany({
      where: { centerId: center.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        photoUrl: true,
        parent: { select: { name: true, email: true } },
        guardians: { where: { isPrimary: true }, select: { guardian: { select: { name: true, email: true } } } },
        classRoom: { select: { name: true, teachers: { select: { teacher: { select: { id: true, name: true, email: true } } } } } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    const childIds = children.map((c) => c.id);
    const since = new Date(Date.now() - LOG_DAYS * 86400000);
    const [progress, grades, plans, logs] = await Promise.all([
      prisma.progress.findMany({
        where: { childId: { in: childIds }, lesson: { isStep: true }, OR: [{ active: true }, { assessedAt: { not: null } }] },
        select: { childId: true, status: true, active: true, lesson: { select: { ageYears: true, ageMonths: true } } },
      }),
      prisma.activityLog.findMany({
        where: { childId: { in: childIds }, createdAt: { gte: dateFrom, lte: endOfTo }, details: { path: ["kind"], equals: "DAILY_GRADE" } },
        select: { childId: true, details: true },
      }),
      prisma.behaviorPlan.findMany({ where: { childId: { in: childIds }, status: { in: CURRENT_IPP_STATUSES } }, select: { childId: true, status: true } }),
      prisma.activityLog.findMany({
        where: { childId: { in: childIds }, createdAt: { gte: since }, type: { in: ["BEHAVIOR", "CHARACTER_HIGHLIGHT"] } },
        select: { type: true, details: true, createdAt: true },
      }),
    ]);

    const students = children.map((c) => {
      const mine = progress.filter((p) => p.childId === c.id);
      const active = mine.filter((p) => p.active).map((p) => ({ step: p.lesson, level: levelForStatus(p.status) }));
      const scores = grades.filter((g) => g.childId === c.id).map((g) => Number(g.details?.grade ?? g.details?.domainAvg)).filter(Number.isFinite);
      const planStatuses = plans.filter((p) => p.childId === c.id).map((p) => p.status);
      const levels = { EXPOSURE: 0, COMPETENCY: 0, MASTERY: 0 };
      for (const p of mine) {
        const level = levelForStatus(p.status);
        if (level in levels) levels[level] += 1;
      }
      const parent = c.guardians?.[0]?.guardian || c.parent;
      const teachers = c.classRoom?.teachers || [];
      return {
        id: c.id,
        name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        photoUrl: c.photoUrl,
        birthDate: c.birthDate,
        parent: parent ? parent.name || parent.email : "",
        teacherIds: teachers.map((t) => t.teacher.id),
        teacher: teachers.map((t) => t.teacher.name || t.teacher.email).join(", "),
        classroom: c.classRoom?.name || "",
        citizenship: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        milestones: active.length ? childStatus(active, c.birthDate) : null,
        levels,
        ipp: planStatuses.length ? (planStatuses.every((s) => s === "ACTIVE") ? "ON_TRACK" : "NOT_ON_TRACK") : null,
      };
    });

    return res.status(200).json({
      centers,
      center,
      range: { from: dayKey(dateFrom), to: dayKey(dateTo) },
      staff,
      students,
      courseCorrections: logs.filter((l) => l.type === "BEHAVIOR" && l.details?.kind !== "DAILY_GRADE").map((l) => ({ type: l.details?.behaviorType || "OTHER", date: dayKey(l.createdAt) })),
      characterHighlights: logs.filter((l) => l.type === "CHARACTER_HIGHLIGHT").map((l) => ({ type: l.details?.characterHighlightType || "OTHER", date: dayKey(l.createdAt) })),
    });
  } catch (e) {
    console.error("center performance error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
