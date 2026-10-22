// Who may open a child's Student Performance Report (server only): the
// child's parents and guardians, plus the staff who can track the child
// (teachers of the class, coaches and Student Support in the center, admins).

import { isChildLinkedToParent } from "@/lib/child-parent-links";
import { hasAnyRole } from "@/lib/roles";
import { canUseChild } from "@/lib/sopServer";

/** child needs id, centerId, classRoomId, parentId and guardians.guardianId. */
export async function canViewChildReport(user, child) {
  if (hasAnyRole(user, ["PARENT"]) && isChildLinkedToParent(child, user.id)) return true;
  return canUseChild(user, child);
}
