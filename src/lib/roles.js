export const ROLE_OPTIONS = ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"];

export const EMPLOYEE_ROLES = ["ADMIN", "TEACHER", "COACH"];

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

export function hasEmployeeRole(roles) {
  return normalizeRoles(roles, "").some(isEmployeeRole);
}

export function roleHomePath(role) {
  switch (String(role || "").toUpperCase()) {
    case "ADMIN":
      return "/admin/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
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
