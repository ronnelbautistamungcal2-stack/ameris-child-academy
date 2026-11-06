import { hasAccessToCenter } from "@/lib/auth";
import { hasAnyRole } from "@/lib/roles";

/** Staff who run volunteer events at a center: admins, and HR and coaches there. */
export async function canManageInvolvement(user, centerId) {
  if (hasAnyRole(user, ["ADMIN"])) return centerId ? hasAccessToCenter(user.id, centerId) : true;
  if (!hasAnyRole(user, ["HR_STAFF", "COACH"])) return false;
  return centerId ? hasAccessToCenter(user.id, centerId) : false;
}
