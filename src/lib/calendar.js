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
