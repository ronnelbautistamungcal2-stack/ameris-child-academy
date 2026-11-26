// Ameris Solutions team roles and rights (Global admin > Permissions & Users,
// client mockup 2026-11-06). Shared by the browser and the server.
//
// A user's rights are their per-user matrix when one was saved, else their
// role's defaults. Global Administrators always have every right, and only
// they manage Permissions & Users. Users made global admins before roles
// existed (globalTeamRole null) are Global Administrators.

export const GLOBAL_SECTIONS = [
  { key: "SUBSCRIBERS", label: "Subscribers", href: "/global/subscribers" },
  { key: "SALES_LEADS", label: "Sales & Leads", href: "/global/leads" },
  { key: "CUSTOMER_SUPPORT", label: "Customer Support", href: "/global/support" },
  { key: "LESSON_BANK", label: "Lesson Bank", href: "/global/curriculum" },
  { key: "SOP_BANK", label: "SOP Bank", href: "/global/curriculum" },
  { key: "REPORTS", label: "Reports", href: "/global/reports" },
  { key: "SETTINGS", label: "Settings", href: "/global/settings" },
];
export const ACTIONS = ["VIEW", "ADD", "EDIT", "DELETE"];
export const ACTION_LABELS = { VIEW: "View", ADD: "Add", EDIT: "Edit", DELETE: "Delete" };

export const TEAM_ROLES = [
  { value: "GLOBAL_ADMINISTRATOR", label: "Global Administrator" },
  { value: "CUSTOMER_SERVICE", label: "Customer Service" },
  { value: "DEVELOPER", label: "Developer" },
  { value: "SALES", label: "Sales" },
];

const ALL = [...ACTIONS];
const VIEW = ["VIEW"];
const ROLE_DEFAULTS = {
  CUSTOMER_SERVICE: {
    SUBSCRIBERS: ["VIEW", "EDIT"],
    SALES_LEADS: VIEW,
    CUSTOMER_SUPPORT: ALL,
    LESSON_BANK: VIEW,
    SOP_BANK: VIEW,
    REPORTS: VIEW,
    SETTINGS: [],
  },
  DEVELOPER: {
    SUBSCRIBERS: VIEW,
    SALES_LEADS: VIEW,
    CUSTOMER_SUPPORT: ["VIEW", "ADD", "EDIT"],
    LESSON_BANK: ALL,
    SOP_BANK: ALL,
    REPORTS: VIEW,
    SETTINGS: VIEW,
  },
  SALES: {
    SUBSCRIBERS: ["VIEW", "ADD"],
    SALES_LEADS: ALL,
    CUSTOMER_SUPPORT: VIEW,
    LESSON_BANK: VIEW,
    SOP_BANK: VIEW,
    REPORTS: VIEW,
    SETTINGS: [],
  },
};

// A person can have several team roles (client sheet 10-29 (11), row 32). They
// are kept in User.globalTeamRole as a comma list ("SALES,CUSTOMER_SERVICE");
// a single value reads the same as before.

/** The person's team roles, in the TEAM_ROLES order; none set = Global Administrator. */
export function teamRolesOf(user) {
  const wanted = new Set(String(user?.globalTeamRole || "").split(",").map((r) => r.trim()).filter(Boolean));
  const roles = TEAM_ROLES.map((r) => r.value).filter((v) => wanted.has(v));
  return roles.length ? roles : ["GLOBAL_ADMINISTRATOR"];
}

/** Valid team roles from a list (or one role), in TEAM_ROLES order; [] if none. */
export function normalizeTeamRoles(input) {
  const wanted = new Set((Array.isArray(input) ? input : [input]).map((r) => String(r || "").trim()));
  return TEAM_ROLES.map((r) => r.value).filter((v) => wanted.has(v));
}

/** The main team role: Global Administrator when they have it, else the first. */
export function teamRoleOf(user) {
  const roles = teamRolesOf(user);
  return roles.includes("GLOBAL_ADMINISTRATOR") ? "GLOBAL_ADMINISTRATOR" : roles[0];
}

export function isGlobalAdministrator(user) {
  return teamRolesOf(user).includes("GLOBAL_ADMINISTRATOR");
}

/** The starting matrix { SECTION: [actions] } of a role, or of several roles together (every right any of them has). */
export function roleDefaults(roleOrRoles) {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  if (!roles.length || roles.some((r) => r === "GLOBAL_ADMINISTRATOR" || !ROLE_DEFAULTS[r])) return Object.fromEntries(GLOBAL_SECTIONS.map((s) => [s.key, ALL]));
  return Object.fromEntries(
    GLOBAL_SECTIONS.map((s) => {
      const union = new Set(roles.flatMap((r) => ROLE_DEFAULTS[r][s.key] || []));
      return [s.key, ACTIONS.filter((a) => union.has(a))];
    }),
  );
}

/** Tidies a matrix from the page: only known sections and actions; ADD/EDIT/DELETE imply VIEW. */
export function normalizeMatrix(input) {
  const src = input && typeof input === "object" ? input : {};
  return Object.fromEntries(
    GLOBAL_SECTIONS.map((s) => {
      const list = ACTIONS.filter((a) => (Array.isArray(src[s.key]) ? src[s.key] : []).includes(a));
      if (list.length && !list.includes("VIEW")) list.unshift("VIEW");
      return [s.key, list];
    }),
  );
}

/** The user's effective rights. */
export function permissionsOf(user) {
  const roles = teamRolesOf(user);
  if (roles.includes("GLOBAL_ADMINISTRATOR")) return roleDefaults("GLOBAL_ADMINISTRATOR");
  return user?.globalPermissions ? normalizeMatrix(user.globalPermissions) : roleDefaults(roles);
}

export function can(user, section, action = "VIEW") {
  if (section === "USERS") return isGlobalAdministrator(user);
  return (permissionsOf(user)[section] || []).includes(action);
}

export function actionForMethod(method) {
  return { GET: "VIEW", HEAD: "VIEW", POST: "ADD", PUT: "EDIT", PATCH: "EDIT", DELETE: "DELETE" }[String(method || "").toUpperCase()] || "VIEW";
}
