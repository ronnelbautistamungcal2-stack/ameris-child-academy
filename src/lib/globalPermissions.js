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

export function teamRoleOf(user) {
  return TEAM_ROLES.some((r) => r.value === user?.globalTeamRole) ? user.globalTeamRole : "GLOBAL_ADMINISTRATOR";
}

export function isGlobalAdministrator(user) {
  return teamRoleOf(user) === "GLOBAL_ADMINISTRATOR";
}

/** The role's starting matrix { SECTION: [actions] }. */
export function roleDefaults(role) {
  if (role === "GLOBAL_ADMINISTRATOR" || !ROLE_DEFAULTS[role]) return Object.fromEntries(GLOBAL_SECTIONS.map((s) => [s.key, ALL]));
  return Object.fromEntries(GLOBAL_SECTIONS.map((s) => [s.key, [...(ROLE_DEFAULTS[role][s.key] || [])]]));
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
  const role = teamRoleOf(user);
  if (role === "GLOBAL_ADMINISTRATOR") return roleDefaults(role);
  return user?.globalPermissions ? normalizeMatrix(user.globalPermissions) : roleDefaults(role);
}

export function can(user, section, action = "VIEW") {
  if (section === "USERS") return isGlobalAdministrator(user);
  return (permissionsOf(user)[section] || []).includes(action);
}

export function actionForMethod(method) {
  return { GET: "VIEW", HEAD: "VIEW", POST: "ADD", PUT: "EDIT", PATCH: "EDIT", DELETE: "DELETE" }[String(method || "").toUpperCase()] || "VIEW";
}
