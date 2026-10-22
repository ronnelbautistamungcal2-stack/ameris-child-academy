import {
  canTeacherAccessChecklist,
  hasChecklistClassroomScope,
} from "@/lib/dailyChecklistClassrooms";
import { canUserBeAssignedChecklist, getChecklistAssignedUserIds } from "@/lib/dailyChecklistAssignees";
import { isStaffPortalRole, STAFF_PORTAL_ROLES } from "@/lib/roles";

const STAFF_CHECKLIST_ROLES = ["TEACHER", ...STAFF_PORTAL_ROLES, "COACH"];

export function getUserChecklistRoles(user) {
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .map((role) => String(role || "").trim())
    .filter((role) => STAFF_CHECKLIST_ROLES.includes(role));

  return [...new Set(roles)];
}

/**
 * Mirrors the visibility rules the GET handler applies for a staff member so
 * admins can preview a checklist exactly as that employee sees it.
 */
export function checklistVisibleToRole(checklist, { role, userId, teacherClassIds = [] }) {
  if (isStaffPortalRole(role)) {
    if (hasChecklistClassroomScope(checklist) || checklist.category === "CLASSROOM") {
      return false;
    }
  }

  if (role === "TEACHER" && !canTeacherAccessChecklist(checklist, teacherClassIds)) {
    return false;
  }

  if (["TEACHER", ...STAFF_PORTAL_ROLES].includes(role) && !canUserBeAssignedChecklist(checklist, userId)) {
    return false;
  }

  return true;
}

// A coach's or admin's own checklist is only what is assigned to them by name;
// someone with no staff role counts as an admin here.
const PERSONAL_ROLES = ["COACH", "ADMIN"];

export function checklistVisibleToStaff(checklist, { roles = [], userId, teacherClassIds = [] }) {
  const effectiveRoles = roles.length ? roles : ["ADMIN"];
  return effectiveRoles.some((role) =>
    PERSONAL_ROLES.includes(role)
      ? getChecklistAssignedUserIds(checklist).includes(userId)
      : checklistVisibleToRole(checklist, { role, userId, teacherClassIds }),
  );
}
