// Shared rules for parent involvement: volunteer slots, sign-ups and logged hours.

export const INVOLVEMENT_NOTES_MAX = 500;

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// A sign-up holds a slot until the day it is for has passed.
export function openSignupWhere(activityIds) {
  return {
    kind: "SIGNUP",
    activityId: Array.isArray(activityIds) ? { in: activityIds } : activityIds,
    occurredAt: { gte: startOfToday() },
  };
}

function parseDateTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
  if (!/^\d{2}:\d{2}$/.test(String(time || ""))) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Turns the form's date + start/end times into stored values, or an error string.
export function parseInvolvementWindow({ date, startTime, endTime }) {
  const start = parseDateTime(date, startTime);
  const end = parseDateTime(date, endTime);
  if (!start) return { error: "A date and start time are required" };
  if (!end) return { error: "An end time is required" };
  if (end <= start) return { error: "End time must be after the start time" };
  const hours = Math.round(((end - start) / 36e5) * 100) / 100;
  return { start, end, hours };
}

function optionalDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function optionalCapacity(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Admin-editable activity fields, only those present in the body.
export function activityData(body) {
  const { description, schedule, startsAt, endsAt, capacity, sortOrder } = body || {};
  return {
    ...(description !== undefined ? { description: description || null } : {}),
    ...(schedule !== undefined ? { schedule: schedule ? String(schedule).trim() : null } : {}),
    ...(startsAt !== undefined ? { startsAt: optionalDate(startsAt) } : {}),
    ...(endsAt !== undefined ? { endsAt: optionalDate(endsAt) } : {}),
    ...(capacity !== undefined ? { capacity: optionalCapacity(capacity) } : {}),
    ...(sortOrder !== undefined ? { sortOrder: Number.parseInt(sortOrder, 10) || 0 } : {}),
  };
}
