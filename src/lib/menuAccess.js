// Who can see and edit which center's menu (server only).

import { accessibleCenterIds, hasAccessToCenter } from "@/lib/auth";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";

/** Menu days are DATE columns; "YYYY-MM-DD" maps to that day at UTC midnight. */
export function dbDate(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * The centers whose menu the user can read: null for admins (all of them);
 * parents also see the centers their children attend.
 */
export async function menuCenterIds(user) {
  if (hasAnyRole(user, ["ADMIN"])) return null;
  const ids = new Set((await accessibleCenterIds(user.id)) || []);
  if (hasAnyRole(user, ["PARENT"])) {
    const children = await prisma.child.findMany({
      where: buildParentLinkedChildWhere(user.id),
      select: { centerId: true },
    });
    for (const child of children) if (child.centerId) ids.add(child.centerId);
  }
  return [...ids];
}

/** PLANNED is the admin's menu; SERVED is recorded by the center's kitchen staff. */
export async function canEditMenuKind(user, centerId, kind) {
  if (hasAnyRole(user, ["ADMIN"])) return true;
  if (kind !== "SERVED" || !hasAnyRole(user, ["KITCHEN_STAFF"])) return false;
  return hasAccessToCenter(user.id, centerId);
}
