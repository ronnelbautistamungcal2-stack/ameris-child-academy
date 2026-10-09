import {
  canTeacherAccessChecklist,
  hasChecklistClassroomScope,
} from "@/lib/dailyChecklistClassrooms";
import { canUserBeAssignedChecklist } from "@/lib/dailyChecklistAssignees";
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

export function checklistVisibleToStaff(checklist, { roles = [], userId, teacherClassIds = [] }) {
  const effectiveRoles = roles.length ? roles : STAFF_PORTAL_ROLES;
  return effectiveRoles.some((role) =>
    checklistVisibleToRole(checklist, { role, userId, teacherClassIds }),
  );
}
