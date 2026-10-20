// Who can see and change Individual Progress Plans (server only).
//
// Student Support, coaches and admins manage plans in their centers.
// Teachers read the plans of children in their classes; parents read their
// own children's plans. Teachers and managers can add IPP log entries.

import { accessibleCenterIds } from "@/lib/auth";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { buildTeacherChildWhere } from "@/lib/teacherScope";

export const IPP_MANAGER_ROLES = ["ADMIN", "COACH", "STUDENT_SUPPORT"];

export function canManageIpp(user) {
  return hasAnyRole(user, IPP_MANAGER_ROLES);
}

/** Prisma `where` for the plans this user may read, or null for none. */
export async function ippScope(user) {
  if (hasAnyRole(user, ["ADMIN"])) return {};
  if (canManageIpp(user)) {
    const ids = (await accessibleCenterIds(user.id)) || [];
    return { centerId: { in: ids } };
  }
  if (hasAnyRole(user, ["TEACHER"])) return { child: await buildTeacherChildWhere(user.id) };
  if (hasAnyRole(user, ["PARENT"])) return { child: buildParentLinkedChildWhere(user.id) };
  return null;
}

/** Whether the user may create a plan for this child. */
export async function canManageChild(user, childId) {
  if (!canManageIpp(user)) return false;
  const child = await prisma.child.findUnique({ where: { id: String(childId) }, select: { centerId: true } });
  if (!child) return false;
  if (hasAnyRole(user, ["ADMIN"])) return true;
  return ((await accessibleCenterIds(user.id)) || []).includes(child.centerId);
}

/**
 * Loads one plan the user may read. Returns { plan, canManage, canLog } or
 * { status, error }.
 */
export async function loadIppForUser(user, id, include) {
  const scope = await ippScope(user);
  if (!scope) return { status: 403, error: "Forbidden" };
  const plan = await prisma.behaviorPlan.findFirst({ where: { id: String(id), ...scope }, include });
  if (!plan) return { status: 404, error: "Progress plan not found" };
  const manage = canManageIpp(user);
  return { plan, canManage: manage, canLog: manage || hasAnyRole(user, ["TEACHER"]) };
}
