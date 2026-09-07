export const ROLE_OPTIONS = ["ADMIN", "TEACHER", "OTHER_STAFF", "PARENT", "COACH", "SUBSCRIBER"];

export const EMPLOYEE_ROLES = ["ADMIN", "TEACHER", "OTHER_STAFF", "COACH"];

export const MANAGER_ROLES = ["ADMIN", "COACH"];

export const STAFF_DEPARTMENTS = [
  "Kitchen",
  "Front Office",
  "Facilities",
  "Transportation",
  "Other",
];

export const KITCHEN_DEPARTMENT = "Kitchen";

export function normalizeStaffDepartment(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = STAFF_DEPARTMENTS.find(
    (dept) => dept.toLowerCase() === raw.toLowerCase(),
  );
  return match || raw;
}

export function isKitchenStaff(user) {
  return (
    normalizeStaffDepartment(user?.staffDepartment).toLowerCase() ===
    KITCHEN_DEPARTMENT.toLowerCase()
  );
}

export function normalizeRoles(value, fallback = "PARENT") {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  for (const raw of source) {
    const role = String(raw || "").trim().toUpperCase();
    if (ROLE_OPTIONS.includes(role) && !out.includes(role)) out.push(role);
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
export function isSelfServiceEmployeeRole(role) {
  const normalizedRole = String(role || "").toUpperCase();
  return isEmployeeRole(normalizedRole) && !isManagerRole(normalizedRole);
}

export function hasEmployeeRole(roles) {
  return normalizeRoles(roles, "").some(isEmployeeRole);
}

export function roleHomePath(role) {
  switch (String(role || "").toUpperCase()) {
    case "ADMIN":
      return "/admin/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
    case "OTHER_STAFF":
      return "/staff/dashboard";
    case "COACH":
      return "/coach/dashboard";
    case "PARENT":
      return "/dashboard";
    case "SUBSCRIBER":
      return "/subscriber";
    default:
      return "/dashboard";
  }
}

export function roleLabel(role) {
  const value = String(role || "").toLowerCase().replace(/_/g, " ");
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
