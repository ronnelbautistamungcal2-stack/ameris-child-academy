import { getSession } from "@/lib/auth";
import { behaviorTypeLabel, characterHighlightLabel } from "@/lib/dailyLogOptions";
import { CURRENT_IPP_STATUSES } from "@/lib/ipp";
import prisma from "@/lib/prisma";
import { goalOffsetDays, levelForStatus, statusForOffset } from "@/lib/sop";
import { canViewChildReport } from "@/lib/reportAccess";

// Student Performance Report (client mockups 2026-10-02), the same report
// for parents, teachers, coaches and Student Support.

const LOG_DAYS = 400; // Citizenship, highlights and corrections the cards can filter
const ACTIVITY_LIMIT = 50;

function dayKey(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Status mix (whole percentages) for a list of { step, level } goals. */
function mix(goals, birthDate) {
  const counts = { CRITICAL: 0, AT_RISK: 0, ON_TRACK: 0, AHEAD: 0, EXCELLING: 0 };
  for (const g of goals) counts[statusForOffset(goalOffsetDays(g.step, g.level, birthDate))] += 1;
  const total = goals.length || 1;
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round((v * 100) / total)]));
}

/**
 * GET /api/v1/reports/student/:childId[?logDate=YYYY-MM-DD]
 * Citizenship Grade scores, Active Goals, Milestones (category and subject
 * status mix from SOP Tracking), Character Highlights and Course
 * Corrections (newest first), open IPPs and the Student Activity Log (latest
 * entries, or one day with logDate).
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    const child = await prisma.child.findUnique({
      where: { id: String(req.query.childId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        photoUrl: true,
        centerId: true,
        classRoomId: true,
        parentId: true,
        enrollmentStartDate: true,
        guardians: { select: { guardianId: true } },
        classRoom: { select: { name: true, teachers: { select: { teacher: { select: { name: true, email: true } } } } } },
      },
    });
    if (!child || !(await canViewChildReport(session.user, child))) return res.status(404).json({ error: "Child not found" });

    const since = new Date(Date.now() - LOG_DAYS * 86400000);
    let activityWhere = { childId: child.id };
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.logDate || ""))) {
      const [y, m, d] = req.query.logDate.split("-").map(Number);
      activityWhere = { childId: child.id, createdAt: { gte: new Date(y, m - 1, d), lt: new Date(y, m - 1, d + 1) } };
    }

    const [progress, logs, plans, activity] = await Promise.all([
      prisma.progress.findMany({
        where: { childId: child.id, lesson: { isStep: true }, OR: [{ active: true }, { assessedAt: { not: null } }] },
        select: {
          status: true,
          active: true,
          lesson: { select: { id: true, title: true, subCategory: true, ageYears: true, ageMonths: true, category: { select: { name: true } } } },
        },
      }),
      prisma.activityLog.findMany({
        where: {
          childId: child.id,
          createdAt: { gte: since },
          OR: [{ type: { in: ["BEHAVIOR", "CHARACTER_HIGHLIGHT"] } }, { details: { path: ["kind"], equals: "DAILY_GRADE" } }],
        },
        select: { id: true, type: true, details: true, notes: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.behaviorPlan.findMany({
        where: { childId: child.id, status: { in: CURRENT_IPP_STATUSES } },
        select: { id: true, title: true, focusArea: true, startDate: true },
        orderBy: { startDate: "desc" },
      }),
      prisma.activityLog.findMany({
        where: activityWhere,
        select: { id: true, type: true, details: true, notes: true, createdAt: true, recordedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
      }),
    ]);

    const goals = progress.map((p) => ({
      step: p.lesson,
      level: levelForStatus(p.status),
      active: p.active,
    }));
    const categories = new Map();
    for (const g of goals) {
      const cat = g.step.category?.name || "General";
      const sub = g.step.subCategory || "Other";
      if (!categories.has(cat)) categories.set(cat, new Map());
      if (!categories.get(cat).has(sub)) categories.get(cat).set(sub, []);
      categories.get(cat).get(sub).push(g);
    }
    const milestones = [...categories.entries()]
      .sort(([a], [b]) => (a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b)))
      .map(([name, subs]) => ({
        name,
        distribution: mix([...subs.values()].flat(), child.birthDate),
        subjects: [...subs.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([subject, list]) => ({ name: subject, distribution: mix(list, child.birthDate) })),
      }));

    return res.status(200).json({
      child: {
        id: child.id,
        name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
        birthDate: child.birthDate,
        photoUrl: child.photoUrl,
        classroom: child.classRoom?.name || "",
        teacher: (child.classRoom?.teachers || []).map((t) => t.teacher.name || t.teacher.email).join(", "),
        startDate: child.enrollmentStartDate,
      },
      citizenship: logs
        .filter((l) => l.details?.kind === "DAILY_GRADE" && Number.isFinite(Number(l.details?.grade ?? l.details?.domainAvg)))
        .map((l) => ({ date: dayKey(l.createdAt), score: Number(l.details.grade ?? l.details.domainAvg) }))
        .reverse(),
      activeGoals: goals.filter((g) => g.active).map((g) => ({ id: g.step.id, title: g.step.title })),
      milestones,
      characterHighlights: logs
        .filter((l) => l.type === "CHARACTER_HIGHLIGHT")
        .map((l) => ({ id: l.id, label: characterHighlightLabel(l.details?.characterHighlightType), date: dayKey(l.createdAt), notes: l.notes || "" })),
      courseCorrections: logs
        .filter((l) => l.type === "BEHAVIOR" && l.details?.kind !== "DAILY_GRADE")
        .map((l) => ({
          id: l.id,
          label: behaviorTypeLabel(l.details?.behaviorType),
          level: Number(l.details?.behaviorLevel) || null,
          date: dayKey(l.createdAt),
          notes: l.notes || "",
        })),
      ipps: plans.map((p) => ({ id: p.id, title: p.focusArea || p.title, date: dayKey(p.startDate) })),
      activity: activity.map((a) => ({
        id: a.id,
        type: a.type,
        details: a.details,
        notes: a.notes,
        createdAt: a.createdAt,
        recordedBy: a.recordedBy?.name || "",
      })),
    });
  } catch (e) {
    console.error("student report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
