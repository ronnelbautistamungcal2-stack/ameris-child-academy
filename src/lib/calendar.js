import { roleLabel } from "@/lib/roles";

// "Apply to Roles" on a calendar event (client mockup 2026-10-29). An event
// with no roles is for everyone.
export const EVENT_ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "COACH", label: "Coach" },
  { value: "TEACHER", label: "Teacher" },
  { value: "KITCHEN_STAFF", label: "Kitchen" },
  { value: "HR_STAFF", label: "HR" },
  { value: "OTHER_STAFF", label: "Other Staff" },
  { value: "STUDENT_SUPPORT", label: "Student Support" },
  { value: "PARENT", label: "Parents" },
];
export const EVENT_STAFF_ROLES = EVENT_ROLE_OPTIONS.map((o) => o.value).filter((r) => r !== "PARENT");
const EVENT_ROLE_VALUES = new Set(EVENT_ROLE_OPTIONS.map((o) => o.value));

/** Keeps known roles only; null when the input isn't an array. */
export function parseEventRoles(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map((r) => String(r || "").toUpperCase()).filter((r) => EVENT_ROLE_VALUES.has(r)))];
}

/** Prisma filter: events for everyone or for this role. Admins see them all. */
export function eventRoleWhere(role) {
  if (String(role || "").toUpperCase() === "ADMIN") return {};
  return { OR: [{ roles: { isEmpty: true } }, { roles: { has: String(role || "").toUpperCase() } }] };
}

export function eventRolesLabel(roles) {
  const list = Array.isArray(roles) ? roles : [];
  if (!list.length) return "Everyone";
  if (EVENT_STAFF_ROLES.every((r) => list.includes(r))) {
    return list.includes("PARENT") ? "All Staff, Parents" : "All Staff";
  }
  return list.map((r) => EVENT_ROLE_OPTIONS.find((o) => o.value === r)?.label || roleLabel(r)).join(", ");
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateOnlyValue(value) {
  return DATE_ONLY_RE.test(String(value || "").trim());
}

function parseDateOnlyParts(value) {
  const match = DATE_ONLY_RE.exec(String(value || "").trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function parseAllDayEventDate(value) {
  const parts = parseDateOnlyParts(value);
  if (parts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseEventDateInput(value, allDay) {
  return allDay ? parseAllDayEventDate(value) : new Date(value);
}

export function formatDateInputValue(value, options = {}) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  if (options.allDay || isDateOnlyValue(value)) {
    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toCalendarDay(value, options = {}) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  if (options.allDay || isDateOnlyValue(value)) {
    return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
