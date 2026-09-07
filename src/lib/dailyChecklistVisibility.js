import {
  canTeacherAccessChecklist,
  hasChecklistClassroomScope,
} from "@/lib/dailyChecklistClassrooms";
import { canUserBeAssignedChecklist } from "@/lib/dailyChecklistAssignees";

const STAFF_CHECKLIST_ROLES = ["TEACHER", "OTHER_STAFF", "COACH"];

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
  if (role === "OTHER_STAFF") {
    if (hasChecklistClassroomScope(checklist) || checklist.category === "CLASSROOM") {
      return false;
    }
  }

  if (role === "TEACHER" && !canTeacherAccessChecklist(checklist, teacherClassIds)) {
    return false;
  }

  if (["TEACHER", "OTHER_STAFF"].includes(role) && !canUserBeAssignedChecklist(checklist, userId)) {
    return false;
  }

  return true;
}

export function checklistVisibleToStaff(checklist, { roles = [], userId, teacherClassIds = [] }) {
  const effectiveRoles = roles.length ? roles : ["OTHER_STAFF"];
  return effectiveRoles.some((role) =>
    checklistVisibleToRole(checklist, { role, userId, teacherClassIds }),
  );
}
