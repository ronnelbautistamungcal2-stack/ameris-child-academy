import { startOfDay } from "@/lib/attendance-classroom";
import { getSession, hasAccessToCenter } from "@/lib/auth";
import { allergyLine } from "@/lib/childProfile";
import { requirementStatus } from "@/lib/complianceRequirements";
import { EMPLOYED_WHERE } from "@/lib/employment";
import { CURRENT_IPP_STATUSES, nextReviewDate } from "@/lib/ipp";
import { MEALS } from "@/lib/menuPlan";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES, hasAnyRole } from "@/lib/roles";
import { SOP_STATUSES, goalStatus, levelForStatus } from "@/lib/sop";

// Role dashboards (client mockups 03-Dashboards, Phase 7): the numbers and
// lists for the Admin, Coach, Kitchen and Student Support dashboards. Each
// view is open to its role and to admins.

const VIEW_ROLES = {
  admin: ["ADMIN"],
  coach: ["ADMIN", "COACH"],
  kitchen: ["ADMIN", "KITCHEN_STAFF"],
  support: ["ADMIN", "STUDENT_SUPPORT"],
};
const STAFF_ROLES = EMPLOYEE_ROLES.filter((r) => r !== "ADMIN");
const UPDATE_DAYS = 7; // Allergy / Infant Feeding Updates: changed this recently
const RED_FLAG_DAYS = 30; // Coach red flags: level 3+ course corrections this recently
const RED_FLAG_LEVEL = 3;
const LOW_GRADE = 2; // Student Performance Alerts: character grade 0-2
const STATUS_ORDER = SOP_STATUSES.map((s) => s.value);

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const childName = (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim();
const shortName = (u) => {
  const parts = String(u?.name || u?.email || "").trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || "";
};

function ageLabel(birthDate, today = new Date()) {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  let months = (today.getFullYear() - b.getFullYear()) * 12 + today.getMonth() - b.getMonth();
  if (today.getDate() < b.getDate()) months -= 1;
  if (months < 0) return "";
  return months < 24 ? `${months} mo` : `${Math.floor(months / 12)} yrs`;
}

function allergyList(child) {
  const fromHealth = Array.isArray(child.healthInfo?.allergies) ? child.healthInfo.allergies : [];
  const list = fromHealth.length ? fromHealth : String(child.allergies || "").split(/[,;]/);
  return list.map((a) => String(a).trim()).filter((a) => a && !/^(none|n\/a|no)$/i.test(a));
}

/** Students and staff signed in today, and each classroom's children in / capacity and teachers signed in. */
async function attendanceSnapshot(centerId, day) {
  const [children, records, rooms, members, clocked] = await Promise.all([
    prisma.child.findMany({
      where: { centerId, OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: day } }] },
      select: { id: true, classRoomId: true },
    }),
    prisma.attendance.findMany({ where: { centerId, day }, select: { childId: true, classRoomId: true, checkedInAt: true, checkedOutAt: true } }),
    prisma.classRoom.findMany({
      where: { centerId },
      select: { id: true, name: true, capacity: true, _count: { select: { children: true } }, teachers: { select: { teacher: { select: { id: true, name: true, email: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { centers: { some: { centerId } }, ...EMPLOYED_WHERE, OR: [{ role: { in: STAFF_ROLES } }, { roles: { hasSome: STAFF_ROLES } }] },
      select: { id: true },
    }),
    prisma.staffAttendance.findMany({ where: { centerId, date: day, clockIn: { not: null }, clockOut: null }, select: { userId: true } }),
  ]);
  const enrolled = new Set(children.map((c) => c.id));
  const home = Object.fromEntries(children.map((c) => [c.id, c.classRoomId]));
  const inByRoom = {};
  let studentsIn = 0;
  for (const r of records) {
    if (!enrolled.has(r.childId) || !r.checkedInAt || r.checkedOutAt) continue;
    studentsIn += 1;
    const room = r.classRoomId || home[r.childId];
    if (room) inByRoom[room] = (inByRoom[room] || 0) + 1;
  }
  const clockedIn = new Set(clocked.map((c) => c.userId));
  const memberIds = new Set(members.map((m) => m.id));
  return {
    students: { in: studentsIn, total: children.length },
    staff: { in: [...clockedIn].filter((id) => memberIds.has(id)).length, total: memberIds.size },
    classrooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      childrenIn: inByRoom[r.id] || 0,
      capacity: r.capacity ?? r._count.children,
      teachersIn: r.teachers.filter((t) => clockedIn.has(t.teacher.id)).map((t) => shortName(t.teacher)),
    })),
  };
}

async function adminView(centerId, today) {
  const requirements = await prisma.complianceRequirement.findMany({
    where: { OR: [{ centerId }, { centerId: null }] },
    select: { frequency: true, nextDue: true, lastCompletedAt: true },
  });
  return { redFlags: requirements.filter((r) => requirementStatus(r, today) === "OVERDUE").length };
}

async function coachView(centerId, today) {
  const since = new Date(today.getTime() - RED_FLAG_DAYS * DAY);
  const [pendingTimeOff, children, plans, corrections] = await Promise.all([
    prisma.timeOffRequest.count({ where: { centerId, status: "PENDING" } }),
    prisma.child.findMany({ where: { centerId, OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: startOfDay(today) } }] }, select: { id: true, allergies: true, healthInfo: true } }),
    prisma.behaviorPlan.findMany({ where: { child: { centerId }, status: { in: CURRENT_IPP_STATUSES } }, select: { childId: true } }),
    prisma.activityLog.findMany({ where: { child: { centerId }, type: "BEHAVIOR", createdAt: { gte: since } }, select: { childId: true, details: true } }),
  ]);
  // Red flags (client): children with an allergy, an open IPP, or a course
  // correction of level 3 or above.
  const flagged = new Set(children.filter((c) => allergyList(c).length).map((c) => c.id));
  const ids = new Set(children.map((c) => c.id));
  for (const p of plans) if (ids.has(p.childId)) flagged.add(p.childId);
  for (const l of corrections) if (ids.has(l.childId) && Number(l.details?.behaviorLevel) >= RED_FLAG_LEVEL) flagged.add(l.childId);
  return { pendingTimeOff, redFlags: flagged.size };
}

async function kitchenView(centerId, today) {
  const since = new Date(today.getTime() - UPDATE_DAYS * DAY);
  const date = new Date(`${dayKey(today)}T00:00:00.000Z`);
  const [children, menu] = await Promise.all([
    prisma.child.findMany({
      where: { centerId, OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: startOfDay(today) } }] },
      select: { id: true, firstName: true, lastName: true, photoUrl: true, allergies: true, healthInfo: true, allergiesUpdatedAt: true, feedingPlanUpdatedAt: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.menuItem.findMany({ where: { centerId, date, kind: "PLANNED" }, select: { meal: true, item: true } }),
  ]);
  const allergies = children
    .map((c) => ({ c, list: allergyList(c) }))
    .filter(({ list }) => list.length)
    .map(({ c, list }) => ({
      id: c.id,
      name: childName(c),
      photoUrl: c.photoUrl,
      allergens: list,
      notes: c.healthInfo?.notes || "",
      updated: Boolean(c.allergiesUpdatedAt && c.allergiesUpdatedAt >= since),
    }));
  const meals = MEALS.map((m) => ({
    key: m.key,
    label: m.label,
    items: [...new Set(menu.filter((i) => i.meal === m.key).map((i) => i.item.trim()).filter(Boolean))],
  })).filter((m) => m.items.length);
  return {
    allergyUpdates: children.filter((c) => c.allergiesUpdatedAt && c.allergiesUpdatedAt >= since).length,
    feedingUpdates: children.filter((c) => c.feedingPlanUpdatedAt && c.feedingPlanUpdatedAt >= since).length,
    allergies: allergies.sort((a, b) => Number(b.updated) - Number(a.updated)),
    menu: meals,
  };
}

async function supportView(centerId, today) {
  const children = await prisma.child.findMany({
    where: { centerId, OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: startOfDay(today) } }] },
    select: { id: true, firstName: true, lastName: true, photoUrl: true, birthDate: true, classRoom: { select: { name: true } } },
  });
  const ids = children.map((c) => c.id);
  const [grades, goals, plans] = await Promise.all([
    prisma.activityLog.findMany({
      where: { childId: { in: ids }, details: { path: ["kind"], equals: "DAILY_GRADE" }, createdAt: { gte: new Date(today.getTime() - RED_FLAG_DAYS * DAY) } },
      select: { childId: true, details: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.progress.findMany({
      where: { childId: { in: ids }, active: true, lesson: { isStep: true } },
      select: { childId: true, status: true, lesson: { select: { ageYears: true, ageMonths: true, maxAgeYears: true, maxAgeMonths: true, subCategory: true, category: { select: { name: true } } } } },
    }),
    prisma.behaviorPlan.findMany({
      where: { childId: { in: ids }, status: { in: CURRENT_IPP_STATUSES } },
      select: { id: true, childId: true, title: true, focusArea: true, startDate: true, reviewSchedule: true },
      orderBy: { startDate: "desc" },
    }),
  ]);
  const byId = Object.fromEntries(children.map((c) => [c.id, c]));
  const row = (c) => ({ id: c.id, name: childName(c), photoUrl: c.photoUrl, age: ageLabel(c.birthDate, today), room: c.classRoom?.name || "" });

  // Latest citizenship (character) grade in the last 30 days.
  const latestGrade = {};
  for (const g of grades) {
    const score = Number(g.details?.grade ?? g.details?.domainAvg);
    if (!(g.childId in latestGrade) && Number.isFinite(score)) latestGrade[g.childId] = score;
  }
  // Each child's lowest active-goal status, and the areas where a goal is Critical.
  const critical = {};
  const worst = {};
  for (const p of goals) {
    const status = goalStatus(p.lesson, levelForStatus(p.status), byId[p.childId]?.birthDate, today);
    if (!(p.childId in worst) || STATUS_ORDER.indexOf(status) < STATUS_ORDER.indexOf(worst[p.childId])) worst[p.childId] = status;
    if (status !== "CRITICAL") continue;
    const area = p.lesson.subCategory || p.lesson.category?.name || "General";
    (critical[p.childId] ||= new Set()).add(area);
  }
  const alerts = children
    .filter((c) => (c.id in latestGrade && latestGrade[c.id] <= LOW_GRADE) || critical[c.id])
    .map((c) => ({ ...row(c), grade: latestGrade[c.id] ?? null, status: worst[c.id] || null, critical: critical[c.id] ? [...critical[c.id]] : [] }))
    .sort((a, b) => b.critical.length - a.critical.length || (a.grade ?? 99) - (b.grade ?? 99));
  const ipps = plans
    .filter((p) => byId[p.childId])
    .map((p) => {
      const review = nextReviewDate(p.startDate, p.reviewSchedule, today);
      return { ...row(byId[p.childId]), planId: p.id, focus: p.focusArea || p.title, reviewDate: review ? dayKey(new Date(review)) : null };
    });
  return { alerts, ipps };
}

/** GET /api/v1/dashboard/summary?view=admin|coach|kitchen|support&centerId= */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    const view = String(req.query.view || "");
    if (!VIEW_ROLES[view]) return res.status(400).json({ error: "Unknown dashboard" });
    if (!hasAnyRole(session.user, VIEW_ROLES[view])) return res.status(403).json({ error: "Forbidden" });
    const centerId = String(req.query.centerId || "");
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!hasAnyRole(session.user, ["ADMIN"]) && !(await hasAccessToCenter(session.user.id, centerId))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const today = new Date();
    const extra = { admin: adminView, coach: coachView, kitchen: kitchenView, support: supportView }[view];
    const [snapshot, details] = await Promise.all([
      view === "support" ? null : attendanceSnapshot(centerId, startOfDay(today)),
      extra(centerId, today),
    ]);
    return res.status(200).json({ view, ...(snapshot || {}), ...details });
  } catch (e) {
    console.error("dashboard summary error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
