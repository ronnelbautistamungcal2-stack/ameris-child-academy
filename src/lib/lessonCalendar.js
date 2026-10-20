// Lesson Calendar day numbering (client request 2026-10-02), shared by the
// admin calendar, the API and the teacher's Weekly Lesson Plan.
//
// School days are Monday–Friday. An anchor { startDate, dayNumber } says
// "startDate is Day dayNumber"; each later school day that is not closed is
// the next day number, until the next anchor restarts the count. Days before
// the first anchor have no number. Dates travel as "YYYY-MM-DD" keys.

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return toDateKey(parseDateKey(value)) === value;
}

export function addDaysKey(key, days) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function isSchoolDay(key) {
  const day = parseDateKey(key).getDay();
  return day >= 1 && day <= 5;
}

/** "YYYY-MM-DD" for a DATE column value (stored at UTC midnight). */
export function dbDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export const MAX_DAY_NUMBER = 999;

/**
 * Day info for every date from `fromKey` to `toKey` (inclusive):
 * { [dateKey]: { day: number|null, closed: boolean } }.
 * `anchors` are { startDate: key, dayNumber }, `closedDays` are keys.
 */
export function dayNumbersBetween(anchors, closedDays, fromKey, toKey) {
  const closed = new Set(closedDays || []);
  const sorted = [...(anchors || [])]
    .filter((a) => isDateKey(a?.startDate) && Number.isInteger(a?.dayNumber))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const out = {};
  if (!isDateKey(fromKey) || !isDateKey(toKey) || fromKey > toKey) return out;

  // Start counting from the last anchor on or before fromKey (or the first
  // anchor inside the range).
  let anchorIndex = -1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].startDate <= fromKey) anchorIndex = i;
  }
  let cursor = anchorIndex >= 0 ? sorted[anchorIndex].startDate : fromKey;
  let next = null; // the day number the next open school day gets
  let nextAnchor = anchorIndex + 1;

  while (cursor <= toKey) {
    if (nextAnchor < sorted.length && sorted[nextAnchor].startDate === cursor) {
      next = sorted[nextAnchor].dayNumber;
      nextAnchor += 1;
    } else if (anchorIndex >= 0 && cursor === sorted[anchorIndex].startDate && next === null) {
      next = sorted[anchorIndex].dayNumber;
    }
    const isClosed = closed.has(cursor) && isSchoolDay(cursor);
    let day = null;
    if (isSchoolDay(cursor) && !isClosed && next !== null) {
      day = next;
      next += 1;
    }
    if (cursor >= fromKey) out[cursor] = { day, closed: isClosed };
    cursor = addDaysKey(cursor, 1);
  }
  return out;
}

/** The day number of one date, or null. */
export function dayNumberOn(anchors, closedDays, key) {
  return dayNumbersBetween(anchors, closedDays, key, key)[key]?.day ?? null;
}

/**
 * The first date on or after `fromKey` (within about two years) that is
 * Day `day`, else the latest earlier one; null when it never happens.
 */
export function findDateForDay(anchors, closedDays, day, fromKey) {
  const sorted = [...(anchors || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!sorted.length) return null;
  const start = sorted[0].startDate < fromKey ? sorted[0].startDate : fromKey;
  const end = addDaysKey(fromKey > sorted[sorted.length - 1].startDate ? fromKey : sorted[sorted.length - 1].startDate, 730);
  const days = dayNumbersBetween(sorted, closedDays, start, end);
  let before = null;
  for (const [key, info] of Object.entries(days)) {
    if (info.day !== day) continue;
    if (key >= fromKey) return key;
    before = key;
  }
  return before;
}
