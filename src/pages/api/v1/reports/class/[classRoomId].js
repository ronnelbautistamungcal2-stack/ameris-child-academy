import { getSession } from "@/lib/auth";
import { findReportableClass } from "@/lib/classReportAccess";
import { BEHAVIOR_TYPE_OPTIONS, CHARACTER_HIGHLIGHT_TYPE_OPTIONS, behaviorTypeLabel } from "@/lib/dailyLogOptions";
import { CURRENT_IPP_STATUSES } from "@/lib/ipp";
import prisma from "@/lib/prisma";
import { goalOffsetDays, levelForStatus, statusForOffset } from "@/lib/sop";

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
 * Goal totals and Milestones (from SOP Tracking), the class's Citizenship
 * Grade average by day, Course Correction and Character Highlight entries
 * (the page counts them for its date range), Students on an Individual
 * Plan, Students on Red Flag (an allergy, or a course correction of level 3
 * or higher) and the class's Student Activity Log.
 */
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
        where: { childId: { in: ids }, lesson: { isStep: true }, OR: [{ active: true }, { assessedAt: { not: null } }] },
        select: { childId: true, status: true, lesson: { select: { ageYears: true, ageMonths: true, category: { select: { name: true } } } } },
      }),
      prisma.activityLog.findMany({
        where: {
          childId: { in: ids },
          createdAt: { gte: since },
          OR: [{ type: { in: ["BEHAVIOR", "CHARACTER_HIGHLIGHT"] } }, { details: { path: ["kind"], equals: "DAILY_GRADE" } }],
        },
        select: { childId: true, type: true, details: true, createdAt: true },
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

    // Goals and milestones
    const counts = { total: 0, completed: 0, failed: 0 };
    const categories = new Map();
    for (const p of progress) {
      const level = levelForStatus(p.status);
      const status = statusForOffset(goalOffsetDays(p.lesson, level, byId[p.childId]?.birthDate));
      counts.total += 1;
      if (level === "MASTERY") counts.completed += 1;
      if (status === "CRITICAL") counts.failed += 1;
      const cat = p.lesson.category?.name || "General";
      if (!categories.has(cat)) categories.set(cat, { CRITICAL: 0, AT_RISK: 0, ON_TRACK: 0, AHEAD: 0, EXCELLING: 0, n: 0 });
      const c = categories.get(cat);
      c[status] += 1;
      c.n += 1;
    }
    const milestones = [...categories.entries()]
      .sort(([a], [b]) => (a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b)))
      .map(([name, { n, ...mix }]) => ({
        name,
        distribution: Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, Math.round((v * 100) / n)])),
      }));

    // Citizenship: class average per day
    const grades = new Map();
    for (const l of logs) {
      if (l.details?.kind !== "DAILY_GRADE") continue;
      const score = Number(l.details.grade ?? l.details.domainAvg);
      if (!Number.isFinite(score)) continue;
      const key = dayKey(l.createdAt);
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
        redFlags.push({ childId: l.childId, name: shortName(byId[l.childId]), flag: behaviorTypeLabel(l.details?.behaviorType), level: Number(l.details.behaviorLevel), date: dayKey(l.createdAt) });
      }
    }

    return res.status(200).json({
      classroom: {
        id: room.id,
        name: room.name,
        teacher: room.teachers.map((t) => t.teacher.name || t.teacher.email).join(", "),
        students: children.length,
      },
      goals: { ...counts, completionRate: counts.total ? Math.round((counts.completed * 100) / counts.total) : 0 },
      milestones,
      citizenship: [...grades.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, g]) => ({ date, score: Math.round((g.sum / g.n) * 10) / 10 })),
      courseCorrectionTypes: BEHAVIOR_TYPE_OPTIONS,
      characterHighlightTypes: CHARACTER_HIGHLIGHT_TYPE_OPTIONS,
      courseCorrections: corrections.map((l) => ({ type: l.details?.behaviorType || "OTHER", date: dayKey(l.createdAt) })),
      characterHighlights: logs
        .filter((l) => l.type === "CHARACTER_HIGHLIGHT")
        .map((l) => ({ type: l.details?.characterHighlightType || "OTHER", date: dayKey(l.createdAt) })),
      ipps: plans.map((p) => ({ id: p.id, childId: p.childId, name: shortName(byId[p.childId]), focusArea: p.focusArea || p.title })),
      redFlags,
      activity: activity.map((a) => ({
        id: a.id,
        type: a.type,
        details: a.details,
        notes: a.notes,
        createdAt: a.createdAt,
        recordedBy: a.recordedBy?.name || "",
        child: shortName(byId[a.childId] || {}),
      })),
    });
  } catch (e) {
    console.error("class report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
