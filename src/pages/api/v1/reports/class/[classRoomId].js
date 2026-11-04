import { getSession } from "@/lib/auth";
import { findReportableClass } from "@/lib/classReportAccess";
import { CHARACTER_HIGHLIGHT_TYPE_OPTIONS, behaviorTypeLabel, characterHighlightLabel, courseCorrectionTypeOptions } from "@/lib/dailyLogOptions";
import { CURRENT_IPP_STATUSES } from "@/lib/ipp";
import prisma from "@/lib/prisma";
import { averagePercent, goalStatus, levelForStatus, sopPercent } from "@/lib/sop";

// Class Performance Report (client mockups 2026-10-02) for one classroom.

const LOG_DAYS = 400;
const ACTIVITY_LIMIT = 50;
const RED_FLAG_LEVEL = 3;

function dayKey(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shortName(child) {
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName[0]}.` : ""}`.trim();
}

/**
 * GET /api/v1/reports/class/:classRoomId[?logDate=YYYY-MM-DD]
 * Milestones (from SOP Tracking), the class's Citizenship
 * Grade average by day, Course Correction and Character Highlight entries
 * (the page counts them for its date range), Students on an Individual
 * Plan, Students on Red Flag (an allergy, or a course correction of level 3
 * or higher) and the class's Student Activity Log.
 */
/** A course correction / character highlight with who it was for and what was logged. */
function logEntry(l, type, label, byId) {
  return {
    id: l.id,
    type,
    label,
    level: Number(l.details?.behaviorLevel) || null,
    date: dayKey(l.createdAt),
    childId: l.childId,
    name: shortName(byId[l.childId] || {}),
    notes: l.notes || "",
    loggedBy: l.recordedBy?.name || l.recordedBy?.email || "",
  };
}

/** Student Activity Log grid: each child's count of logs by type and the latest (client mockup r176). */
async function activityCounts(ids, byId) {
  if (!ids.length) return [];
  const rows = await prisma.activityLog.groupBy({
    by: ["childId", "type"],
    where: { childId: { in: ids } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const out = new Map(ids.map((id) => [id, { childId: id, name: shortName(byId[id] || {}), counts: {}, total: 0, lastAt: null }]));
  for (const r of rows) {
    const entry = out.get(r.childId);
    if (!entry) continue;
    entry.counts[r.type] = r._count._all;
    entry.total += r._count._all;
    if (!entry.lastAt || r._max.createdAt > entry.lastAt) entry.lastAt = r._max.createdAt;
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    const room = await findReportableClass(session.user, req.query.classRoomId);
    if (!room) return res.status(404).json({ error: "Classroom not found" });

    const children = await prisma.child.findMany({
      where: { classRoomId: room.id },
      select: { id: true, firstName: true, lastName: true, birthDate: true, allergies: true },
    });
    const ids = children.map((c) => c.id);
    const byId = Object.fromEntries(children.map((c) => [c.id, c]));
    const since = new Date(Date.now() - LOG_DAYS * 86400000);
    let activityWhere = { childId: { in: ids } };
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.logDate || ""))) {
      const [y, m, d] = req.query.logDate.split("-").map(Number);
      activityWhere = { ...activityWhere, createdAt: { gte: new Date(y, m - 1, d), lt: new Date(y, m - 1, d + 1) } };
    }

    const [progress, logs, plans, activity] = await Promise.all([
      prisma.progress.findMany({
        where: { childId: { in: ids }, lesson: { isStep: true }, OR: [{ active: true }, { assessedAt: { not: null } }, { status: { not: "NOT_STARTED" } }] },
        select: { childId: true, status: true, active: true, lesson: { select: { ageYears: true, ageMonths: true, maxAgeYears: true, maxAgeMonths: true, category: { select: { name: true } } } } },
      }),
      prisma.activityLog.findMany({
        where: {
          childId: { in: ids },
          createdAt: { gte: since },
          OR: [{ type: { in: ["BEHAVIOR", "CHARACTER_HIGHLIGHT"] } }, { details: { path: ["kind"], equals: "DAILY_GRADE" } }],
        },
        select: { id: true, childId: true, type: true, details: true, notes: true, createdAt: true, recordedBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.behaviorPlan.findMany({
        where: { childId: { in: ids }, status: { in: CURRENT_IPP_STATUSES } },
        select: { id: true, childId: true, focusArea: true, title: true },
      }),
      prisma.activityLog.findMany({
        where: activityWhere,
        select: { id: true, childId: true, type: true, details: true, notes: true, createdAt: true, recordedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
      }),
    ]);

    // Milestones
    const categories = new Map();
    // Which students make up each colour, per category (client request 2026-10-29).
    const studentsByStatus = new Map();
    for (const p of progress) {
      const level = levelForStatus(p.status);
      const status = goalStatus(p.lesson, level, byId[p.childId]?.birthDate);
      const cat = p.lesson.category?.name || "General";
      if (!categories.has(cat)) categories.set(cat, { CRITICAL: 0, AT_RISK: 0, ON_TRACK: 0, AHEAD: 0, EXCELLING: 0, n: 0 });
      const c = categories.get(cat);
      c[status] += 1;
      c.n += 1;
      if (!studentsByStatus.has(cat)) studentsByStatus.set(cat, {});
      const byStatus = studentsByStatus.get(cat);
      const list = (byStatus[status] ||= []);
      const existing = list.find((s) => s.childId === p.childId);
      if (existing) existing.goals.push(p.lesson.title);
      else list.push({ childId: p.childId, name: shortName(byId[p.childId] || {}), goals: [p.lesson.title] });
    }
    const milestones = [...categories.entries()]
      .sort(([a], [b]) => (a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b)))
      .map(([name, { n, ...mix }]) => ({
        name,
        distribution: Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, Math.round((v * 100) / n)])),
        students: studentsByStatus.get(name) || {},
      }));

    // Milestones % (the teacher's SOP %, client 2026-10-23): each student's
    // average % over the goals they are working on, General category left
    // out, averaged over the students.
    const milestonePct = averagePercent(
      children.map((c) =>
        sopPercent(
          progress
            .filter((p) => p.childId === c.id)
            .map((p) => ({ step: p.lesson, level: levelForStatus(p.status), active: p.active, category: p.lesson.category?.name || "General" })),
          c.birthDate,
          { excludeGeneral: true },
        ),
      ),
    );

    // Citizenship: each student's grades (for the weighted class %) and the
    // class average per day (for the chart).
    const studentGrades = [];
    const grades = new Map();
    for (const l of logs) {
      if (l.details?.kind !== "DAILY_GRADE") continue;
      const score = Number(l.details.grade ?? l.details.domainAvg);
      if (!Number.isFinite(score)) continue;
      const key = dayKey(l.createdAt);
      studentGrades.push({ childId: l.childId, date: key, score });
      const g = grades.get(key) || { sum: 0, n: 0 };
      grades.set(key, { sum: g.sum + score, n: g.n + 1 });
    }

    const corrections = logs.filter((l) => l.type === "BEHAVIOR" && l.details?.kind !== "DAILY_GRADE");
    const redFlags = [];
    for (const c of children) {
      if (c.allergies && c.allergies.trim() && !/^(none|n\/a|no)$/i.test(c.allergies.trim())) {
        redFlags.push({ childId: c.id, name: shortName(c), flag: `Allergy: ${c.allergies.trim()}`, date: null });
      }
    }
    for (const l of corrections) {
      if (Number(l.details?.behaviorLevel) >= RED_FLAG_LEVEL) {
        redFlags.push({ childId: l.childId, name: shortName(byId[l.childId]), flag: l.details?.behaviorName || behaviorTypeLabel(l.details?.behaviorType), level: Number(l.details.behaviorLevel), date: dayKey(l.createdAt) });
      }
    }

    return res.status(200).json({
      classroom: {
        id: room.id,
        name: room.name,
        teacher: room.teachers.map((t) => t.teacher.name || t.teacher.email).join(", "),
        students: children.length,
      },
      milestones,
      milestonePct,
      citizenship: [...grades.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, g]) => ({ date, score: Math.round((g.sum / g.n) * 10) / 10 })),
      citizenshipGrades: studentGrades,
      courseCorrectionTypes: courseCorrectionTypeOptions(
        (await prisma.characterCategory.findMany({ select: { name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })).map((c) => c.name),
        corrections.map((l) => ({ type: l.details?.behaviorType || "OTHER" })),
      ),
      characterHighlightTypes: CHARACTER_HIGHLIGHT_TYPE_OPTIONS,
      courseCorrections: corrections.map((l) => logEntry(l, l.details?.behaviorType || "OTHER", l.details?.behaviorName || behaviorTypeLabel(l.details?.behaviorType), byId)),
      characterHighlights: logs
        .filter((l) => l.type === "CHARACTER_HIGHLIGHT")
        .map((l) => logEntry(l, l.details?.characterHighlightType || "OTHER", characterHighlightLabel(l.details?.characterHighlightType), byId)),
      activityCounts: await activityCounts(ids, byId),
      ipps: plans.map((p) => ({ id: p.id, childId: p.childId, name: shortName(byId[p.childId]), focusArea: p.focusArea || p.title })),
      redFlags,
      activity: activity.map((a) => ({
        id: a.id,
        type: a.type,
        details: a.details,
        notes: a.notes,
        createdAt: a.createdAt,
        recordedBy: a.recordedBy?.name || "",
        childId: a.childId,
        child: shortName(byId[a.childId] || {}),
      })),
    });
  } catch (e) {
    console.error("class report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
