// Small date/time helpers shared by the checklist pages.

export function todayKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function shiftDayKey(key, days) {
  const [y, m, d] = String(key).split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + days));
}

export function formatDayKey(key, options = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", options);
}

/** "14:30" -> "2:30 PM". */
export function formatTaskTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute || 0), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function sortByTaskTime(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const left = a.taskTime || "99:99";
    const right = b.taskTime || "99:99";
    if (left !== right) return left.localeCompare(right);
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}
