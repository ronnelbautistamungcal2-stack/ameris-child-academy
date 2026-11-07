export const ROLE_OPTIONS = [
  "ADMIN",
  "TEACHER",
  "OTHER_STAFF",
  "KITCHEN_STAFF",
  "HR_STAFF",
  "STUDENT_SUPPORT",
  "PARENT",
  "COACH",
];

/**
 * Roles that sign in to the staff portal (/staff). They share its
 * self-service pages (checklist, performance, time off, resources, messages)
 * and differ only in their extra sections.
 */
export const STAFF_PORTAL_ROLES = ["OTHER_STAFF", "KITCHEN_STAFF", "HR_STAFF", "STUDENT_SUPPORT"];

export const EMPLOYEE_ROLES = ["ADMIN", "TEACHER", ...STAFF_PORTAL_ROLES, "COACH"];

export const MANAGER_ROLES = ["ADMIN", "COACH"];

// Kitchen is a role now (KITCHEN_STAFF), not a department.
export const STAFF_DEPARTMENTS = [
  "Front Office",
  "Facilities",
  "Transportation",
  "Other",
];

export function normalizeStaffDepartment(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = STAFF_DEPARTMENTS.find(
    (dept) => dept.toLowerCase() === raw.toLowerCase(),
  );
  return match || raw;
}

export function isStaffPortalRole(role) {
  return STAFF_PORTAL_ROLES.includes(String(role || "").toUpperCase());
}

export function isKitchenStaff(user) {
  return userRoles(user).includes("KITCHEN_STAFF");
}

// Ameris Solutions staff. Never offered in center role pickers, and only a
// global admin can grant it (src/pages/api/v1/users).
export const GLOBAL_ADMIN_ROLE = "GLOBAL_ADMIN";
const KNOWN_ROLES = [...ROLE_OPTIONS, GLOBAL_ADMIN_ROLE];

/** Drops GLOBAL_ADMIN from roles a center admin asked for. */
export function centerAssignableRoles(roles) {
  return (roles || []).filter((role) => role !== GLOBAL_ADMIN_ROLE);
}

export function normalizeRoles(value, fallback = "PARENT") {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  for (const raw of source) {
    const role = String(raw || "").trim().toUpperCase();
    if (KNOWN_ROLES.includes(role) && !out.includes(role)) out.push(role);
  }
  if (!out.length && fallback) out.push(fallback);
  return out;
}

export function primaryRoleFromRoles(value, fallback = "PARENT") {
  return normalizeRoles(value, fallback)[0] || fallback;
}

export function userRoles(user) {
  return normalizeRoles(user?.roles, user?.role || "PARENT");
}

/**
 * The user as the role they are signed in as (session.user.role), so access
 * checks don't mix in their other roles: a teacher who is also a coach sees
 * only their own class on the teacher pages (client requests 2026-10-29).
 */
export function signedInAs(user) {
  if (!user?.role) return user;
  return { ...user, roles: [String(user.role).toUpperCase()] };
}

export function hasAnyRole(user, roles) {
  const allowed = new Set(normalizeRoles(roles, ""));
  return userRoles(user).some((role) => allowed.has(role));
}

export function isEmployeeRole(role) {
  return EMPLOYEE_ROLES.includes(String(role || "").toUpperCase());
}

/**
 * Roles that manage staff operations (roster, shifts, time off, training,
 * supply requests) center-wide rather than only for themselves. Coaches are
 * always scoped to the centers they belong to; admins are not.
 */
export function isManagerRole(role) {
  return MANAGER_ROLES.includes(String(role || "").toUpperCase());
}

/**
 * Employees who only ever see and edit their own staff records. Managers see
 * the whole center, so they are excluded here.
 */
/** Who builds shift schedules: admins, coaches and HR (client request 2026-10-02). */
export function canManageShifts(role) {
  return ["ADMIN", "COACH", "HR_STAFF"].includes(String(role || "").toUpperCase());
}

export function isSelfServiceEmployeeRole(role) {
  const normalizedRole = String(role || "").toUpperCase();
  return isEmployeeRole(normalizedRole) && !isManagerRole(normalizedRole);
}

export function hasEmployeeRole(roles) {
  return normalizeRoles(roles, "").some(isEmployeeRole);
}

export function roleHomePath(role) {
  switch (String(role || "").toUpperCase()) {
    case "GLOBAL_ADMIN":
      return "/global/subscribers";
    case "ADMIN":
      return "/admin/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
    case "OTHER_STAFF":
    case "KITCHEN_STAFF":
    case "HR_STAFF":
    case "STUDENT_SUPPORT":
      return "/staff/dashboard";
    case "COACH":
      return "/coach/dashboard";
    case "PARENT":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

const ROLE_LABELS = {
  GLOBAL_ADMIN: "Global Administrator",
  HR_STAFF: "HR Staff",
  STUDENT_SUPPORT: "Student Support Staff",
};

export function roleLabel(role) {
  const label = ROLE_LABELS[String(role || "").toUpperCase()];
  if (label) return label;
  const value = String(role || "").toLowerCase().replace(/_/g, " ");
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
