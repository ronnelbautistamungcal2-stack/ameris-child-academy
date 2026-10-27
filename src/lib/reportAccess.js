// Who may open which report (server only).
//
// canViewChildReport: a child's Student Performance Report, for the child's
// parents and guardians plus the staff who can track the child (teachers of
// the class, coaches and Student Support in the center, admins).
// reportCenter: which center a center-wide report may be run for.

import { hasAccessToCenter } from "@/lib/auth";
import { isChildLinkedToParent } from "@/lib/child-parent-links";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { canUseChild } from "@/lib/sopServer";

/** child needs id, centerId, classRoomId, parentId and guardians.guardianId. */
export async function canViewChildReport(user, child) {
  if (hasAnyRole(user, ["PARENT"]) && isChildLinkedToParent(child, user.id)) return true;
  return canUseChild(user, child);
}

/** Admins can use any center; other allowed roles only the centers they belong to. */
export async function reportCenter(user, centerId, roles) {
  if (!hasAnyRole(user, roles)) return { status: 403, error: "Forbidden" };
  const center = centerId ? await prisma.center.findUnique({ where: { id: String(centerId) }, select: { id: true, name: true } }) : null;
  if (!center) return { status: 400, error: "centerId is required" };
  if (user.role !== "ADMIN" && !(await hasAccessToCenter(user.id, center.id))) return { status: 403, error: "Forbidden" };
  return { center };
}

/** Children whose enrollment hasn't ended (Reports filter "Currently enrolled"). */
export function enrolledWhere(today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return { OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: start } }] };
}
