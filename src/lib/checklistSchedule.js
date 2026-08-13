export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday", shortLabel: "Sun" },
  { value: 1, label: "Monday", shortLabel: "Mon" },
  { value: 2, label: "Tuesday", shortLabel: "Tue" },
  { value: 3, label: "Wednesday", shortLabel: "Wed" },
  { value: 4, label: "Thursday", shortLabel: "Thu" },
  { value: 5, label: "Friday", shortLabel: "Fri" },
  { value: 6, label: "Saturday", shortLabel: "Sat" },
];

export const CHECKLIST_FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONE_TIME", label: "One Time" },
];

export function normalizeChecklistFrequency(value) {
  const normalized = String(value || "DAILY").toUpperCase();
  return ["DAILY", "WEEKLY", "MONTHLY", "ONE_TIME"].includes(normalized)
    ? normalized
    : "DAILY";
}

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

export const MONTHLY_WEEK_OPTIONS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: -1, label: "Last" },
];

export function normalizeMonthlyWeek(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num === -1) return -1;
  if (num >= 1 && num <= 4) return num;
  return null;
}

export function normalizeMonthlyWeekday(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0 || num > 6) return null;
  return num;
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const parsed = new Date(year, month, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeOneTimeDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isNthWeekdayOfMonth(date, weekday, week) {
  if (date.getDay() !== weekday) return false;
  if (week === -1) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
    return next.getMonth() !== date.getMonth();
  }
  return Math.ceil(date.getDate() / 7) === week;
}

function sameCalendarDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatDateInputValue(value) {
  const date = normalizeOneTimeDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const frequency = normalizeChecklistFrequency(checklist?.frequency);
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
    const week = normalizeMonthlyWeek(checklist?.monthlyWeek);
    const weekday = normalizeMonthlyWeekday(checklist?.monthlyWeekday);
    if (week !== null && weekday !== null) {
      const weekLabel =
        MONTHLY_WEEK_OPTIONS.find((option) => option.value === week)?.label || ordinal(week);
      const weekdayLabel =
        WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label || `Day ${weekday}`;
      return `Every ${weekLabel} ${weekdayLabel}`;
    }
    const day = normalizeMonthlyDay(checklist?.monthlyDay);
    return day ? `Monthly on the ${ordinal(day)}` : "Monthly";
  }

  if (frequency === "ONE_TIME") {
    const date = normalizeOneTimeDate(checklist?.oneTimeDate);
    return date
      ? `One time on ${date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : "One time";
  }

  return "Daily";
}

export function scheduleMatchesDate(checklist, value) {
  const date = toDate(value);
  if (!date) return true;

  const frequency = normalizeChecklistFrequency(checklist?.frequency);
  if (frequency === "WEEKLY") {
    const days = normalizeRepeatDays(checklist?.repeatDays);
    if (!days.length) return true;
    return days.includes(date.getDay());
  }

  if (frequency === "MONTHLY") {
    const week = normalizeMonthlyWeek(checklist?.monthlyWeek);
    const weekday = normalizeMonthlyWeekday(checklist?.monthlyWeekday);
    if (week !== null && weekday !== null) {
      return isNthWeekdayOfMonth(date, weekday, week);
    }
    const day = normalizeMonthlyDay(checklist?.monthlyDay);
    if (!day) return true;
    return date.getDate() === day;
  }

  if (frequency === "ONE_TIME") {
    const oneTimeDate = normalizeOneTimeDate(checklist?.oneTimeDate);
    if (!oneTimeDate) return true;
    return sameCalendarDate(oneTimeDate, date);
  }

  return true;
}

export function checklistMatchesDate(checklist, value) {
  return scheduleMatchesDate(checklist, value);
}

export function getEffectiveItemSchedule(item, checklist) {
  const frequency = normalizeChecklistFrequency(
    item?.frequency || checklist?.frequency,
  );

  const itemHasOwnMonthlySchedule =
    normalizeMonthlyDay(item?.monthlyDay) !== null ||
    (normalizeMonthlyWeek(item?.monthlyWeek) !== null &&
      normalizeMonthlyWeekday(item?.monthlyWeekday) !== null);
  const monthlySource = itemHasOwnMonthlySchedule ? item : checklist;
  const monthlyWeek =
    frequency === "MONTHLY" ? normalizeMonthlyWeek(monthlySource?.monthlyWeek) : null;
  const monthlyWeekday =
    frequency === "MONTHLY" ? normalizeMonthlyWeekday(monthlySource?.monthlyWeekday) : null;
  const usesMonthlyWeekdayMode = monthlyWeek !== null && monthlyWeekday !== null;

  return {
    frequency,
    repeatDays:
      frequency === "WEEKLY"
        ? normalizeRepeatDays(
            Array.isArray(item?.repeatDays) && item.repeatDays.length
              ? item.repeatDays
              : checklist?.repeatDays,
          )
        : [],
    monthlyDay:
      frequency === "MONTHLY" && !usesMonthlyWeekdayMode
        ? normalizeMonthlyDay(monthlySource?.monthlyDay)
        : null,
    monthlyWeek: usesMonthlyWeekdayMode ? monthlyWeek : null,
    monthlyWeekday: usesMonthlyWeekdayMode ? monthlyWeekday : null,
    oneTimeDate:
      frequency === "ONE_TIME" ? normalizeOneTimeDate(item?.oneTimeDate) : null,
  };
}

export function itemMatchesDate(item, value, checklist) {
  return scheduleMatchesDate(getEffectiveItemSchedule(item, checklist), value);
}

function scheduleSignature(schedule) {
  const frequency = normalizeChecklistFrequency(schedule?.frequency);
  const repeatDays =
    frequency === "WEEKLY" ? normalizeRepeatDays(schedule?.repeatDays).join(",") : "";
  const monthlyDay = frequency === "MONTHLY" ? String(normalizeMonthlyDay(schedule?.monthlyDay) || "") : "";
  const monthlyWeekday =
    frequency === "MONTHLY" &&
    normalizeMonthlyWeek(schedule?.monthlyWeek) !== null &&
    normalizeMonthlyWeekday(schedule?.monthlyWeekday) !== null
      ? `${schedule.monthlyWeek}-${schedule.monthlyWeekday}`
      : "";
  const oneTimeDate =
    frequency === "ONE_TIME" && normalizeOneTimeDate(schedule?.oneTimeDate)
      ? formatDateInputValue(schedule.oneTimeDate)
      : "";
  return `${frequency}|${repeatDays}|${monthlyDay}|${monthlyWeekday}|${oneTimeDate}`;
}

export function summarizeChecklistFrequency(checklist) {
  const items = Array.isArray(checklist?.items) ? checklist.items : [];
  if (!items.length) return normalizeChecklistFrequency(checklist?.frequency);

  const values = new Set(
    items.map((item) => getEffectiveItemSchedule(item, checklist).frequency),
  );
  return values.size === 1 ? [...values][0] : "MIXED";
}

export function summarizeChecklistSchedule(checklist) {
  const items = Array.isArray(checklist?.items) ? checklist.items : [];
  if (!items.length) return describeChecklistSchedule(checklist);

  const signatures = new Map();
  for (const item of items) {
    const schedule = getEffectiveItemSchedule(item, checklist);
    signatures.set(scheduleSignature(schedule), schedule);
  }

  if (signatures.size === 1) {
    return describeChecklistSchedule([...signatures.values()][0]);
  }

  const frequency = summarizeChecklistFrequency(checklist);
  if (frequency === "WEEKLY") return "Weekly (mixed days)";
  if (frequency === "MONTHLY") return "Monthly (mixed days)";
  if (frequency === "ONE_TIME") return "One-time items";
  if (frequency === "DAILY") return "Daily";
  return "Mixed schedules";
}
