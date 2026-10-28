// Checklist Review (client request 2026-10-02): how much of their checklist
// each staff member finished on a day, and the same figure over a date range
// for the checklist part of their grade. Server only.

import { itemMatchesDate } from "@/lib/checklistSchedule";
import { checklistVisibleToStaff, getUserChecklistRoles } from "@/lib/dailyChecklistVisibility";
import { roleLabel, STAFF_PORTAL_ROLES } from "@/lib/roles";
import { EMPLOYED_WHERE } from "@/lib/employment";

export const REVIEW_ROLES = ["TEACHER", ...STAFF_PORTAL_ROLES, "COACH"];

export const REVIEW_STATUSES = [
  { value: "COMPLETE", label: "Complete" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "ABSENT", label: "Absent" },
  { value: "NO_CHECKLIST", label: "No Checklist" },
];

export function dayKey(date) {
  const d = new Date(date);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** DATE columns hold "YYYY-MM-DD" at UTC midnight. */
export function dbDay(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

function utcKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

const CHECKLIST_INCLUDE = {
  items: { orderBy: [{ taskTime: "asc" }, { sortOrder: "asc" }] },
  classRoom: { select: { id: true, name: true } },
  classrooms: { include: { classRoom: { select: { id: true, name: true } } } },
  assignees: { select: { userId: true } },
};

async function loadCenterChecklists(prisma, centerId) {
  return prisma.dailyChecklist.findMany({
    where: { centerId, active: true },
    include: CHECKLIST_INCLUDE,
    orderBy: { title: "asc" },
  });
}

async function teacherClassMap(prisma, centerId, userIds) {
  const rows = await prisma.teacherClass.findMany({
    where: { teacherId: { in: userIds }, classRoom: { centerId } },
    select: { teacherId: true, classId: true },
  });
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.teacherId)) map.set(row.teacherId, []);
    map.get(row.teacherId).push(row.classId);
  }
  return map;
}

function roomsOf(checklist) {
  const rooms = (checklist.classrooms || []).map((c) => c.classRoom).filter(Boolean);
  if (!rooms.length && checklist.classRoom) rooms.push(checklist.classRoom);
  return rooms;
}

/**
 * The checklists a staff member is responsible for on a day. Teachers with
 * more than one fill out the one they picked (or, without a pick, the one
 * they ticked most, else the first); everyone else fills out all of them.
 */
function listsForDay({ member, checklists, teacherClassIds, key, choiceId, doneIds }) {
  const roles = getUserChecklistRoles(member);
  const due = checklists
    .filter((c) => checklistVisibleToStaff(c, { roles, userId: member.id, teacherClassIds }))
    .map((c) => ({ ...c, items: c.items.filter((item) => itemMatchesDate(item, key, c)) }))
    .filter((c) => c.items.length);
  if (!roles.includes("TEACHER") || due.length < 2) return due;
  const chosen = due.find((c) => c.id === choiceId);
  if (chosen) return [chosen];
  const ticked = (c) => c.items.filter((item) => doneIds.has(item.id)).length;
  return [due.slice().sort((a, b) => ticked(b) - ticked(a))[0]];
}

function primaryRole(member) {
  const roles = getUserChecklistRoles(member);
  return roles[0] || member.role;
}

/**
 * One row per staff member for a center and day. With `userId`, only that
 * person, with their items and daily log entries (the View Details pop-up).
 */
export async function checklistReview(prisma, { centerId, date, userId = "" }) {
  const key = dayKey(date);
  const day = dbDay(key);
  const members = await prisma.user.findMany({
    where: {
      ...(userId ? { id: userId } : EMPLOYED_WHERE),
      centers: { some: { centerId } },
      OR: [{ role: { in: REVIEW_ROLES } }, { roles: { hasSome: REVIEW_ROLES } }],
    },
    select: { id: true, name: true, email: true, role: true, roles: true, staffDepartment: true, pictureUrl: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  const ids = members.map((m) => m.id);
  const startOfDay = new Date(`${key}T00:00:00`);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [checklists, classMap, choices, completions, notes, absences, timeOff, shifts] = await Promise.all([
    loadCenterChecklists(prisma, centerId),
    teacherClassMap(prisma, centerId, ids),
    prisma.dailyChecklistChoice.findMany({ where: { userId: { in: ids }, date: day }, select: { userId: true, checklistId: true } }),
    prisma.dailyChecklistCompletion.findMany({
      where: { completedById: { in: ids }, date: day, item: { checklist: { centerId } } },
      select: { itemId: true, completedById: true, completedAt: true },
    }),
    prisma.dailyChecklistNote.findMany({
      where: { createdById: { in: ids }, date: day, checklist: { centerId } },
      select: { checklistId: true, createdById: true, notes: true, updatedAt: true },
    }),
    prisma.staffAttendance.findMany({
      where: { userId: { in: ids }, centerId, status: "ABSENT", date: { gte: startOfDay, lt: endOfDay } },
      select: { userId: true, notes: true },
    }),
    prisma.timeOffRequest.findMany({
      where: { userId: { in: ids }, centerId, status: "APPROVED", startDate: { lt: endOfDay }, endDate: { gte: startOfDay } },
      select: { userId: true, type: true, reason: true },
    }),
    prisma.shiftSchedule.findMany({
      where: { userId: { in: ids }, centerId, date: { gte: startOfDay, lt: endOfDay } },
      select: { userId: true, position: true },
    }),
  ]);

  const rows = members.map((member) => {
    const mine = completions.filter((c) => c.completedById === member.id);
    const doneAt = new Map(mine.map((c) => [c.itemId, c.completedAt]));
    const lists = listsForDay({
      member,
      checklists,
      teacherClassIds: classMap.get(member.id) || [],
      key,
      choiceId: choices.find((c) => c.userId === member.id)?.checklistId,
      doneIds: new Set(doneAt.keys()),
    });
    const items = lists.flatMap((c) =>
      c.items.map((item) => ({
        id: item.id,
        checklistId: c.id,
        checklistTitle: c.title,
        title: item.title,
        taskTime: item.taskTime,
        done: doneAt.has(item.id),
        completedAt: doneAt.get(item.id) || null,
      })),
    );
    const done = items.filter((i) => i.done).length;
    const listIds = new Set(lists.map((c) => c.id));
    const myNotes = notes.filter((n) => n.createdById === member.id && listIds.has(n.checklistId) && n.notes.trim());
    const absence = absences.find((a) => a.userId === member.id);
    const off = timeOff.find((t) => t.userId === member.id);
    const absent = !!(absence || off);
    const updates = [...items.map((i) => i.completedAt), ...myNotes.map((n) => n.updatedAt)].filter(Boolean).map((d) => new Date(d));
    const rooms = [...new Map(lists.flatMap(roomsOf).map((r) => [r.id, r])).values()];
    const role = primaryRole(member);
    const pct = items.length ? Math.round((done * 100) / items.length) : null;
    return {
      id: member.id,
      name: member.name || member.email,
      email: member.email,
      pictureUrl: member.pictureUrl || null,
      role,
      position: shifts.find((s) => s.userId === member.id)?.position || member.staffDepartment || roleLabel(role),
      area: rooms.length ? rooms.map((r) => r.name).join(", ") : member.staffDepartment || roleLabel(role),
      classRoomIds: rooms.map((r) => r.id),
      checklistTitles: lists.map((c) => c.title),
      total: items.length,
      done,
      pct,
      missing: items.filter((i) => !i.done).map((i) => i.title),
      notes: absent
        ? [absence?.notes || (off ? `Time off${off.reason ? ` – ${off.reason}` : ""}` : "Absent")].filter(Boolean).join("; ")
        : myNotes.map((n) => n.notes).join(" · "),
      lastUpdated: updates.length ? new Date(Math.max(...updates.map((d) => d.getTime()))) : null,
      status: absent ? "ABSENT" : !items.length ? "NO_CHECKLIST" : done === items.length ? "COMPLETE" : done ? "IN_PROGRESS" : "NOT_STARTED",
      ...(userId ? { items } : {}),
    };
  });

  if (!userId) return { date: key, rows };

  const logs = await prisma.activityLog.findMany({
    where: { recordedById: userId, createdAt: { gte: startOfDay, lt: endOfDay }, child: { centerId } },
    select: {
      id: true,
      type: true,
      details: true,
      notes: true,
      createdAt: true,
      child: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return { date: key, row: rows[0] || null, logs };
}

/**
 * Share of due checklist items a staff member ticked over a date range, on
 * the days they worked (attendance that isn't Absent, else weekdays without
 * approved time off). Teachers count only the checklist they picked each day.
 */
export async function checklistCompletionForRange(prisma, { userId, centerId, dateFrom, dateTo }) {
  const member = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, roles: true } });
  if (!member) return { completedCount: 0, assignedCount: 0, pct: null };
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const [checklists, classMap, choices, completions, attendance, timeOff] = await Promise.all([
    loadCenterChecklists(prisma, centerId),
    teacherClassMap(prisma, centerId, [userId]),
    prisma.dailyChecklistChoice.findMany({ where: { userId, date: { gte: dbDay(dayKey(from)), lte: dbDay(dayKey(to)) } } }),
    prisma.dailyChecklistCompletion.findMany({
      where: { completedById: userId, date: { gte: dbDay(dayKey(from)), lte: dbDay(dayKey(to)) }, item: { checklist: { centerId } } },
      select: { itemId: true, date: true },
    }),
    prisma.staffAttendance.findMany({ where: { userId, centerId, date: { gte: from, lte: to } }, select: { date: true, status: true } }),
    prisma.timeOffRequest.findMany({
      where: { userId, centerId, status: "APPROVED", startDate: { lte: to }, endDate: { gte: from } },
      select: { startDate: true, endDate: true },
    }),
  ]);

  let days;
  if (attendance.length) {
    days = [...new Set(attendance.filter((a) => a.status !== "ABSENT").map((a) => dayKey(a.date)))];
  } else {
    days = [];
    const off = (d) => timeOff.some((t) => d >= new Date(new Date(t.startDate).setHours(0, 0, 0, 0)) && d <= t.endDate);
    for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to && days.length < 400; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6 && !off(d)) days.push(dayKey(d));
    }
  }

  const doneByDay = new Map();
  for (const c of completions) {
    const key = utcKey(c.date);
    if (!doneByDay.has(key)) doneByDay.set(key, new Set());
    doneByDay.get(key).add(c.itemId);
  }
  let assigned = 0;
  let completed = 0;
  for (const key of days) {
    const doneIds = doneByDay.get(key) || new Set();
    const lists = listsForDay({
      member,
      checklists,
      teacherClassIds: classMap.get(userId) || [],
      key,
      choiceId: choices.find((c) => utcKey(c.date) === key)?.checklistId,
      doneIds,
    });
    for (const list of lists) {
      assigned += list.items.length;
      completed += list.items.filter((item) => doneIds.has(item.id)).length;
    }
  }
  return { completedCount: completed, assignedCount: assigned, pct: assigned ? Math.round((completed * 100) / assigned) : null };
}
