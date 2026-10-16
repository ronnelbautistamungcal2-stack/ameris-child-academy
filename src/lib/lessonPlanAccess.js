// Server helpers for the Lesson Calendar and Lesson Planner.

import { hasAccessToCenter } from "@/lib/auth";
import { dbDateKey } from "@/lib/lessonCalendar";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";

export const PLAN_VIEW_ROLES = ["ADMIN", "TEACHER", "COACH"];

/** "YYYY-MM-DD" day as a DATE column value. */
export function dbDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * Checks the user may read this classroom's calendar/planner. Returns
 * { classRoom } or { status, error }. Pass admin to require an admin.
 */
export async function classroomAccess(user, centerId, classRoomId, { admin = false } = {}) {
  if (!centerId || !classRoomId) return { status: 400, error: "centerId and classRoomId are required" };
  if (admin ? !hasAnyRole(user, ["ADMIN"]) : !hasAnyRole(user, PLAN_VIEW_ROLES)) {
    return { status: 403, error: admin ? "Only admins can change the curriculum" : "Forbidden" };
  }
  if (!hasAnyRole(user, ["ADMIN"]) && !(await hasAccessToCenter(user.id, centerId))) {
    return { status: 403, error: "Forbidden" };
  }
  const classRoom = await prisma.classRoom.findFirst({
    where: { id: String(classRoomId), centerId: String(centerId) },
    select: { id: true, name: true, centerId: true },
  });
  if (!classRoom) return { status: 404, error: "Classroom not found" };
  return { classRoom };
}

/** A classroom's anchors and its center's closed days, as date keys. */
export async function loadCalendar(centerId, classRoomId) {
  const [anchors, closed] = await Promise.all([
    prisma.lessonCalendarAnchor.findMany({ where: { classRoomId }, orderBy: { startDate: "asc" } }),
    prisma.lessonClosedDay.findMany({ where: { centerId }, orderBy: { date: "asc" } }),
  ]);
  return {
    anchors: anchors.map((a) => ({ startDate: dbDateKey(a.startDate), dayNumber: a.dayNumber })),
    closedDays: closed.map((c) => dbDateKey(c.date)),
  };
}
