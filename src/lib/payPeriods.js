// Pay periods (client request 2026-10-23): each center picks, on the Add/Edit
// Center form, either every two weeks counted from a start date, or twice a
// month (1st–15th and 16th–end of month). Staff Attendance's "Current Pay
// Period" and My Time Sheet follow the center's choice. Ranges are
// "YYYY-MM-DD" keys.

import { shiftDayKey, todayKey } from "@/lib/checklistTime";

export const PAY_SCHEDULES = [
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "SEMI_MONTHLY", label: "Twice a month (1st–15th & 16th–end)" },
];

export const DEFAULT_PAY_PERIOD = { type: "BIWEEKLY", startDate: "2026-09-01" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const RANGE_OPTIONS = [
  { value: "PAY_PERIOD", label: "Current Pay Period" },
  { value: "WEEK", label: "This Week" },
  { value: "MONTH", label: "This Month" },
];

/** Validates the form's pay schedule. Returns { value } or { error }. */
export function parsePayPeriodSettings(input) {
  if (!input || typeof input !== "object") return { error: "Choose a pay schedule" };
  if (input.type === "SEMI_MONTHLY") return { value: { type: "SEMI_MONTHLY" } };
  if (input.type === "BIWEEKLY") {
    if (!DATE.test(String(input.startDate || ""))) return { error: "Choose the first day of a two-week pay period" };
    return { value: { type: "BIWEEKLY", startDate: input.startDate } };
  }
  return { error: "Choose a pay schedule" };
}

/** The center's pay schedule, falling back to the default. */
export function payPeriodSettingsFor(center) {
  const parsed = center?.payPeriodSettings ? parsePayPeriodSettings(center.payPeriodSettings) : null;
  return parsed?.value || DEFAULT_PAY_PERIOD;
}

function toDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

/** The range of the given kind containing `key` (pay periods follow `settings`). */
export function rangeContaining(kind, key = todayKey(), settings = DEFAULT_PAY_PERIOD) {
  const d = toDate(key);
  if (kind === "WEEK") {
    const start = shiftDayKey(key, d.getDay() === 0 ? -6 : 1 - d.getDay());
    return { from: start, to: shiftDayKey(start, 6) };
  }
  if (kind === "MONTH" || settings.type === "SEMI_MONTHLY") {
    const first = todayKey(new Date(d.getFullYear(), d.getMonth(), 1));
    const last = todayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    if (kind === "MONTH") return { from: first, to: last };
    return d.getDate() <= 15
      ? { from: first, to: todayKey(new Date(d.getFullYear(), d.getMonth(), 15)) }
      : { from: todayKey(new Date(d.getFullYear(), d.getMonth(), 16)), to: last };
  }
  const anchor = settings.startDate || DEFAULT_PAY_PERIOD.startDate;
  const offset = Math.floor(daysBetween(anchor, key) / 14) * 14;
  const from = shiftDayKey(anchor, offset);
  return { from, to: shiftDayKey(from, 13) };
}

/** The range before (-1) or after (+1) `range` of the same kind. */
export function stepRange(kind, range, direction, settings = DEFAULT_PAY_PERIOD) {
  return rangeContaining(kind, direction < 0 ? shiftDayKey(range.from, -1) : shiftDayKey(range.to, 1), settings);
}
