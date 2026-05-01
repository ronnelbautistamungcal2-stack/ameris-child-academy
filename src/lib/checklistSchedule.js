export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday", shortLabel: "Sun" },
  { value: 1, label: "Monday", shortLabel: "Mon" },
  { value: 2, label: "Tuesday", shortLabel: "Tue" },
  { value: 3, label: "Wednesday", shortLabel: "Wed" },
  { value: 4, label: "Thursday", shortLabel: "Thu" },
  { value: 5, label: "Friday", shortLabel: "Fri" },
  { value: 6, label: "Saturday", shortLabel: "Sat" },
];

export function normalizeRepeatDays(value) {
  const source = Array.isArray(value) ? value : value == null ? [] : [value];
  const seen = new Set();
  const out = [];

  for (const raw of source) {
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 0 || num > 6 || seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }

  return out.sort((a, b) => a - b);
}

export function normalizeMonthlyDay(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 31) return null;
  return num;
}

function toDate(value) {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ordinal(value) {
  const abs = Math.abs(Number(value));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${abs}th`;
  switch (abs % 10) {
    case 1:
      return `${abs}st`;
    case 2:
      return `${abs}nd`;
    case 3:
      return `${abs}rd`;
    default:
      return `${abs}th`;
  }
}

export function describeChecklistSchedule(checklist) {
  const frequency = String(checklist?.frequency || "DAILY").toUpperCase();
  if (frequency === "WEEKLY") {
    const days = normalizeRepeatDays(checklist?.repeatDays);
    if (!days.length) return "Weekly";
    const labels = days.map(
      (value) =>
        WEEKDAY_OPTIONS.find((option) => option.value === value)?.label || `Day ${value}`,
    );
    return labels.length === 1 ? `Every ${labels[0]}` : `Every ${labels.join(", ")}`;
  }

  if (frequency === "MONTHLY") {
    const day = normalizeMonthlyDay(checklist?.monthlyDay);
    return day ? `Monthly on the ${ordinal(day)}` : "Monthly";
  }

  return "Daily";
}

export function checklistMatchesDate(checklist, value) {
  const date = toDate(value);
  if (!date) return true;

  const frequency = String(checklist?.frequency || "DAILY").toUpperCase();
  if (frequency === "WEEKLY") {
    const days = normalizeRepeatDays(checklist?.repeatDays);
    if (!days.length) return true;
    return days.includes(date.getDay());
  }

  if (frequency === "MONTHLY") {
    const day = normalizeMonthlyDay(checklist?.monthlyDay);
    if (!day) return true;
    return date.getDate() === day;
  }

  return true;
}
