// Date ranges for Staff Attendance's "Current Pay Period" menu. Pay periods
// are two weeks long, counted from PAY_PERIOD_ANCHOR (Sep 1, 2026 matches the
// client's mockup: Sep 1 – Sep 14). Ranges are "YYYY-MM-DD" keys.

import { shiftDayKey, todayKey } from "@/lib/checklistTime";

export const PAY_PERIOD_ANCHOR = "2026-09-01";
export const PAY_PERIOD_DAYS = 14;

export const RANGE_OPTIONS = [
  { value: "PAY_PERIOD", label: "Current Pay Period" },
  { value: "WEEK", label: "This Week" },
  { value: "MONTH", label: "This Month" },
];

function toDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

/** The range of the given kind containing `key`. */
export function rangeContaining(kind, key = todayKey()) {
  if (kind === "WEEK") {
    const day = toDate(key).getDay();
    const start = shiftDayKey(key, day === 0 ? -6 : 1 - day);
    return { from: start, to: shiftDayKey(start, 6) };
  }
  if (kind === "MONTH") {
    const d = toDate(key);
    return { from: todayKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: todayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  const offset = Math.floor(daysBetween(PAY_PERIOD_ANCHOR, key) / PAY_PERIOD_DAYS) * PAY_PERIOD_DAYS;
  const from = shiftDayKey(PAY_PERIOD_ANCHOR, offset);
  return { from, to: shiftDayKey(from, PAY_PERIOD_DAYS - 1) };
}

/** The range before (-1) or after (+1) `range` of the same kind. */
export function stepRange(kind, range, direction) {
  return rangeContaining(kind, direction < 0 ? shiftDayKey(range.from, -1) : shiftDayKey(range.to, 1));
}
