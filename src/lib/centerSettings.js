// Add/Edit Center (client request 2026-10-02): Basic Information, Care &
// Schedule, Ages & Rates and Roles. One parser validates everything the form
// sends, so the API and the form agree on the shape of the JSON settings.

import { hasEmployeeRole, ROLE_OPTIONS } from "@/lib/roles";
import { parseStaffGradeWeights } from "@/lib/staffGrade";
import { parsePayPeriodSettings } from "@/lib/payPeriods";

export const CENTER_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "INACTIVE", label: "Inactive" },
];

export const CENTER_TYPES = ["Child Care Center", "Preschool", "Infant & Toddler Center", "Before & After School", "Other"];

// The meals a center can provide, in serving order. Which ones are provided
// decides which menu pages every role sees.
export const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "amSnack", label: "AM Snack" },
  { key: "lunch", label: "Lunch" },
  { key: "pmSnack", label: "PM Snack" },
  { key: "dinner", label: "Dinner" },
  { key: "eveningSnack", label: "Evening Snack" },
];

export const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

// Roles a center can grant on the Roles tab (saved for later; not enforced).
export const CENTER_ROLE_OPTIONS = ROLE_OPTIONS.filter((role) => role !== "SUBSCRIBER");

export const MAX_AGE_MONTHS = 18 * 12;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function defaultCareSchedule() {
  return Object.fromEntries(
    DAYS.map(({ key }, i) => [key, i < 5 ? { open: true, start: "07:30", end: "16:45" } : { open: false, start: null, end: null }]),
  );
}

export function defaultMeals() {
  return Object.fromEntries(MEALS.map(({ key }) => [key, { provided: false, catered: false }]));
}

/** The meal keys a center provides, in serving order. */
export function providedMealKeys(center) {
  const meals = center?.meals || {};
  return MEALS.map((m) => m.key).filter((key) => meals[key]?.provided);
}

function text(value, max = 200) {
  const v = String(value ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function wholeNumber(value, label) {
  if (value === null || value === undefined || value === "") return { value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return { error: `${label} must be a whole number of 0 or more` };
  return { value: n };
}

function money(value, label) {
  if (value === null || value === undefined || value === "") return { value: null };
  const n = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return { error: `${label} must be an amount of 0 or more` };
  return { value: Math.round(n * 100) / 100 };
}

function parseSchedule(value) {
  if (!value || typeof value !== "object") return { error: "Care schedule is invalid" };
  const out = {};
  for (const { key, label } of DAYS) {
    const day = value[key] || {};
    const open = Boolean(day.open);
    const start = day.start || null;
    const end = day.end || null;
    if (open) {
      if (!TIME.test(start || "") || !TIME.test(end || "")) return { error: `Enter start and end times for ${label}` };
      if (start >= end) return { error: `${label} must end after it starts` };
    }
    out[key] = { open, start: open ? start : null, end: open ? end : null };
  }
  return { value: out };
}

function parseMealAgeGroups(value) {
  if (!Array.isArray(value)) return { error: "Age group meal configuration is invalid" };
  const out = [];
  for (const [i, group] of value.entries()) {
    const from = Number(group?.fromMonths);
    const to = Number(group?.toMonths);
    if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_AGE_MONTHS)) {
      return { error: `Choose both ages for meal age group ${i + 1}` };
    }
    if (from > to) return { error: `Meal age group ${i + 1} must go from the younger age to the older one` };
    out.push({ fromMonths: from, toMonths: to });
  }
  out.sort((a, b) => a.fromMonths - b.fromMonths);
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].fromMonths <= out[i - 1].toMonths) return { error: "Meal age groups must not overlap" };
  }
  return { value: out };
}

function parseMeals(value) {
  if (!value || typeof value !== "object") return { error: "Meals are invalid" };
  const out = {};
  for (const { key } of MEALS) {
    const provided = Boolean(value[key]?.provided);
    out[key] = { provided, catered: provided && Boolean(value[key]?.catered) };
  }
  return { value: out };
}

function parseAgeRates(value) {
  if (!Array.isArray(value)) return { error: "Age groups and rates are invalid" };
  const out = [];
  for (const [i, row] of value.entries()) {
    const label = text(row?.label, 80);
    if (!label) return { error: `Name age group ${i + 1}` };
    const rates = {};
    for (const field of ["monthly", "weekly", "daily", "hourly"]) {
      const parsed = money(row?.[field], `${label} ${field} rate`);
      if (parsed.error) return parsed;
      rates[field] = parsed.value;
    }
    out.push({ label, ...rates });
  }
  return { value: out };
}

/**
 * Validates Add/Edit Center input. With partial, fields left out of the body
 * are left unchanged. Returns { data } ready for prisma, or { error }.
 * directorId is returned as given; the API checks it names an employee.
 */
export function parseCenterInput(body = {}, { partial = false } = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const data = {};

  if (!partial || has("name")) {
    const name = text(body.name, 120);
    if (!name) return { error: "Center name is required" };
    data.name = name;
  }
  if (has("status")) {
    if (!CENTER_STATUSES.some((s) => s.value === body.status)) return { error: "Choose a status" };
    data.status = body.status;
  }
  for (const [key, max] of [["centerType", 80], ["address", 200], ["city", 100], ["state", 40], ["zip", 20], ["phone", 40], ["region", 80], ["photoUrl", 2000]]) {
    if (has(key)) data[key] = text(body[key], max);
  }
  if (has("notes")) data.notes = text(body.notes, 500);
  if (has("contactEmail")) {
    const email = text(body.contactEmail, 200);
    if (email && !EMAIL.test(email)) return { error: "Enter a valid email address" };
    data.contactEmail = email;
  }
  if (has("directorId")) data.directorId = text(body.directorId, 64);
  for (const [key, label] of [["classroomCount", "Number of classrooms"], ["capacity", "Maximum capacity"]]) {
    if (has(key)) {
      const parsed = wholeNumber(body[key], label);
      if (parsed.error) return parsed;
      data[key] = parsed.value;
    }
  }
  if (has("enrollmentFee")) {
    const parsed = money(body.enrollmentFee, "Initial enrollment fee");
    if (parsed.error) return parsed;
    data.enrollmentFee = parsed.value;
  }
  if (has("autoCheckoutTime")) {
    const value = body.autoCheckoutTime ? String(body.autoCheckoutTime) : null;
    if (value && !TIME.test(value)) return { error: "Automatic checkout time must be HH:MM" };
    data.autoCheckoutTime = value;
  }
  const jsonFields = [
    ["careSchedule", parseSchedule],
    ["mealAgeGroups", parseMealAgeGroups],
    ["meals", parseMeals],
    ["ageRates", parseAgeRates],
    ["staffGradeWeights", parseStaffGradeWeights],
    ["payPeriodSettings", parsePayPeriodSettings],
  ];
  for (const [key, parse] of jsonFields) {
    if (!has(key)) continue;
    if (body[key] === null) {
      data[key] = null;
      continue;
    }
    const parsed = parse(body[key]);
    if (parsed.error) return parsed;
    data[key] = parsed.value;
  }
  if (has("roleAccess")) {
    const roles = Array.isArray(body.roleAccess) ? body.roleAccess.map((r) => String(r).toUpperCase()) : [];
    if (roles.some((r) => !CENTER_ROLE_OPTIONS.includes(r))) return { error: "Unknown role on the Roles tab" };
    data.roleAccess = [...new Set(roles)];
  }
  return { data };
}

/** "1 year", "18 months", "3 years" for the meal age group pickers. */
export function formatAgeMonths(months) {
  if (months < 24 && months % 12 !== 0) return `${months} month${months === 1 ? "" : "s"}`;
  const years = months / 12;
  if (Number.isInteger(years)) return `${years} year${years === 1 ? "" : "s"}`;
  return `${months} months`;
}

/** Error message when directorId does not name an employee, otherwise null. */
export async function directorError(prisma, directorId) {
  if (!directorId) return null;
  const user = await prisma.user.findUnique({ where: { id: directorId }, select: { role: true, roles: true } });
  if (!user || !hasEmployeeRole(user.roles?.length ? user.roles : [user.role])) return "Choose a staff member as director";
  return null;
}
