// Subscription add-ons (client sheet "Pages and Sections to Grey out based on
// Add ons", 2026-11-06). Shared by the browser and the server, so no imports.

export const ADD_ONS = ["STEPS_OF_PROGRESSION", "CURRICULUM", "TEACHER_TRAINING", "STAFF_MANAGEMENT"];

export const ADD_ON_LABELS = {
  STEPS_OF_PROGRESSION: "Steps of Progression",
  CURRICULUM: "Curriculum",
  TEACHER_TRAINING: "Teacher Training",
  STAFF_MANAGEMENT: "Staff Management",
};

export const ACCOUNT_STATUSES = ["PENDING", "ACTIVE", "ON_HOLD", "CANCELLED"];

export const ACCOUNT_STATUS_LABELS = {
  PENDING: "Pending Approval",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

export function normalizeAddOns(value) {
  const list = Array.isArray(value) ? value : [];
  return ADD_ONS.filter((key) => list.map((v) => String(v).toUpperCase()).includes(key));
}

// Whole pages each add-on locks, by route. A page listed under two add-ons
// needs both. Pages with only some sections locked use <AddOnGate> instead.
const PAGE_ADD_ONS = {
  // Admin
  "/admin/time-off": ["STAFF_MANAGEMENT"],
  "/admin/staff-list": ["STAFF_MANAGEMENT"],
  "/admin/curriculum/calendar": ["CURRICULUM"],
  "/admin/checklist-review": ["STAFF_MANAGEMENT"],
  "/admin/training-pathways": ["TEACHER_TRAINING"],
  // Teacher
  "/teacher/time-off": ["STAFF_MANAGEMENT"],
  "/teacher/progress": ["STEPS_OF_PROGRESSION"],
  // Coach
  "/coach/my-time-off": ["STAFF_MANAGEMENT"],
  "/coach/checklist-review": ["STAFF_MANAGEMENT"],
  "/coach/staff-attendance": ["STAFF_MANAGEMENT"],
  "/coach/shifts": ["STAFF_MANAGEMENT"],
  "/coach/time-off": ["STAFF_MANAGEMENT"],
  "/coach/evaluations": ["STAFF_MANAGEMENT"],
  "/coach/staff-performance": ["STAFF_MANAGEMENT"],
  "/coach/training": ["TEACHER_TRAINING"],
  "/coach/professional-development": ["TEACHER_TRAINING"],
  "/coach/progress": ["STEPS_OF_PROGRESSION"],
  // Every staff portal role (Kitchen, HR, Student Support, Other Staff)
  "/staff/time-off": ["STAFF_MANAGEMENT"],
  // HR
  "/staff/hr/staff-performance": ["STAFF_MANAGEMENT"],
  "/staff/hr/shift-schedules": ["STAFF_MANAGEMENT"],
  "/staff/hr/staff-attendance": ["STAFF_MANAGEMENT"],
  "/staff/hr/staff-list": ["STAFF_MANAGEMENT"],
  // Student Support
  "/staff/student-support/developmental-assessment": ["STEPS_OF_PROGRESSION"],
  "/staff/student-support/progression-tracking": ["STEPS_OF_PROGRESSION"],
  "/staff/student-support/reports/milestone-progress": ["STEPS_OF_PROGRESSION"],
  "/staff/student-support/reports/child-steps": ["STEPS_OF_PROGRESSION"],
};

// HR and Other Staff: every page of theirs is Staff Management (client
// sheet 2026-11-06), except the dashboard, messages and My Performance, whose
// tabs lock themselves (Professional Development is Teacher Training).
const STAFF_MANAGEMENT_ROLES = ["HR_STAFF", "OTHER_STAFF"];
const ALWAYS_OPEN_STAFF_PAGES = ["/staff/dashboard", "/staff/messages", "/staff/performance"];

/**
 * Add-ons a route needs, or [] when the page is in the base package. role
 * (the signed-in role) matters for the shared /staff pages.
 */
export function addOnsForPath(path, role = "") {
  const clean = String(path || "").split("?")[0].replace(/\/+$/, "");
  if (
    STAFF_MANAGEMENT_ROLES.includes(role) &&
    clean.startsWith("/staff/") &&
    !ALWAYS_OPEN_STAFF_PAGES.some((open) => clean === open || clean.startsWith(`${open}/`))
  ) {
    return ["STAFF_MANAGEMENT"];
  }
  if (PAGE_ADD_ONS[clean]) return PAGE_ADD_ONS[clean];
  // Sub-pages (e.g. /coach/evaluations/[id]) follow their parent page.
  const parent = Object.keys(PAGE_ADD_ONS)
    .filter((key) => clean.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  return parent ? PAGE_ADD_ONS[parent] : [];
}

/** The add-ons in `needed` that `enabled` is missing. null enabled = no limits. */
export function missingAddOns(needed, enabled) {
  if (enabled == null) return [];
  const have = new Set(enabled);
  return (needed || []).filter((key) => !have.has(key));
}
