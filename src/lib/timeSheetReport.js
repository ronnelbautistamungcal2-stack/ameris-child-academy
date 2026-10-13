// Time sheet report math (client mockups 2026-10-02): days grouped into
// Monday-Sunday weeks clipped to the report's date range, hours per day, a
// weekly total and a total for the date range.

const DAY_MS = 24 * 60 * 60 * 1000;

export function hoursBetween(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  const ms = new Date(timeOut).getTime() - new Date(timeIn).getTime();
  return ms > 0 ? ms / (60 * 60 * 1000) : 0;
}

export function roundHours(hours) {
  return Math.round(hours * 100) / 100;
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayOf(value) {
  const d = startOfDay(value);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - offset * DAY_MS);
}

/**
 * Groups rows ({ day, timeIn, timeOut, ... }) into weeks within [from, to].
 * Returns { weeks: [{ start, end, rows, totalHours }], totalHours }.
 */
export function groupIntoWeeks(rows, from, to) {
  const rangeStart = startOfDay(from);
  const rangeEnd = startOfDay(to);
  const weeks = new Map();
  for (const row of rows) {
    const day = startOfDay(row.day);
    if (day < rangeStart || day > rangeEnd) continue;
    const monday = mondayOf(day);
    const key = monday.getTime();
    if (!weeks.has(key)) {
      const sunday = new Date(key + 6 * DAY_MS);
      weeks.set(key, {
        start: monday < rangeStart ? rangeStart : monday,
        end: sunday > rangeEnd ? rangeEnd : sunday,
        rows: [],
        totalHours: 0,
      });
    }
    const week = weeks.get(key);
    const hours = roundHours(hoursBetween(row.timeIn, row.timeOut));
    week.rows.push({ ...row, hours });
    week.totalHours = roundHours(week.totalHours + hours);
  }
  const list = [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([, week]) => week);
  return { weeks: list, totalHours: roundHours(list.reduce((sum, w) => sum + w.totalHours, 0)) };
}
