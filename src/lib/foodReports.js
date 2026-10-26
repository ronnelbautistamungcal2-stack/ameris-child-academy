// Kitchen and meal reports (client request 2026-10-23): Infant Portions on the
// kitchen Menu Planner, the Infant Feeding Report, the Meal Production Record
// and the Meal Claim. Shared by the pages and the API.

import { MEALS } from "@/lib/menuPlan";

/** Teachers log meals with a mealType (BREAKFAST, AM_SNACK, ...); menus use keys (breakfast, amSnack, ...). */
export const MEAL_TYPE_TO_KEY = {
  BREAKFAST: "breakfast",
  AM_SNACK: "amSnack",
  LUNCH: "lunch",
  PM_SNACK: "pmSnack",
  DINNER: "dinner",
  EVENING_SNACK: "eveningSnack",
};

/** Meal Claim column letters, in menu order. */
export const MEAL_LETTERS = { breakfast: "B", amSnack: "A", lunch: "L", pmSnack: "P", dinner: "D", eveningSnack: "E" };

export const INFANT_GROUPS = ["youngerInfants", "olderInfants"];

export function mealLabel(key) {
  return MEALS.find((m) => m.key === key)?.label || key;
}

/** The menu meal key of a MEAL/SNACK activity log, or null. */
export function mealKeyForLog(details) {
  const d = details && typeof details === "object" ? details : {};
  const type = String(d.mealType || "").toUpperCase();
  if (MEAL_TYPE_TO_KEY[type]) return MEAL_TYPE_TO_KEY[type];
  const label = String(d.meal || "").toLowerCase().replace(/[^a-z]/g, "");
  const match = MEALS.find((m) => m.label.toLowerCase().replace(/[^a-z]/g, "") === label);
  return match?.key || null;
}

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of a timestamp in the server's local day (how activity logs are bucketed). */
export function localDateKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

/** Every date key from `from` to `to`, inclusive (capped at `max` days). */
export function dateKeysBetween(from, to, max = 400) {
  const out = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end && out.length < max) {
    out.push(localDateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Whole months old on a date key. */
export function ageInMonths(birthDate, dateKey) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const on = new Date(`${dateKey}T12:00:00`);
  let months = (on.getFullYear() - b.getUTCFullYear()) * 12 + (on.getMonth() - b.getUTCMonth());
  if (on.getDate() < b.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** Younger Infants are 0-5 months, Older Infants 6-11 months; null from 12 months. */
export function infantGroupFor(months) {
  if (months == null || months >= 12) return null;
  return months < 6 ? "youngerInfants" : "olderInfants";
}

/** Meal Claim age: years, or "0.<months>" under a year (as on the client's sheet). */
export function claimAge(birthDate, dateKey) {
  const months = ageInMonths(birthDate, dateKey);
  if (months == null) return "";
  return months < 12 ? `0.${months}` : String(Math.floor(months / 12));
}

/** Which children age group (from the center's menu age groups) a child falls in on a date. */
export function childrenGroupFor(groups, months) {
  if (months == null) return null;
  for (const g of groups) {
    const m = /^children-(\d+)-(\d+)$/.exec(g.key);
    if (m && months >= Number(m[1]) && months <= Number(m[2])) return g.key;
    if (g.key === "children" && months >= 12) return g.key;
  }
  return null;
}

/** "8:15 AM" from an activity log (its details.time "HH:MM", else its timestamp). */
export function logTime(log) {
  const t = /^(\d{1,2}):(\d{2})/.exec(String(log?.details?.time || ""));
  const d = new Date(log.createdAt);
  const h = t ? Number(t[1]) : d.getHours();
  const m = t ? Number(t[2]) : d.getMinutes();
  return { label: `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`, minutes: h * 60 + m };
}

export const COPYRIGHT = "© 2026 Kingston Laboratories LLC d/b/a Ameris Solutions. All rights reserved.";
