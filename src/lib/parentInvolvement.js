// Shared rules for parent involvement: volunteer events, sign-ups and logged
// hours (client mockups 16-01..06).


export const INVOLVEMENT_NOTES_MAX = 500;

export const EVENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "PLANNING", label: "Planning" },
];

// Target Audience. Age bands are my guess: infants under 12 months, toddlers
// 12-35 months, preschool 36-71 months.
export const AUDIENCES = [
  { value: "ALL", label: "All Families" },
  { value: "INFANT", label: "Infant Families", minMonths: 0, maxMonths: 11 },
  { value: "TODDLER", label: "Toddler Families", minMonths: 12, maxMonths: 35 },
  { value: "PRESCHOOL", label: "Preschool Families", minMonths: 36, maxMonths: 71 },
  { value: "CLASSROOMS", label: "Specific Classrooms" },
];

// The statement a parent signs when logging volunteer hours.
export const INVOLVEMENT_CERTIFICATION = "I certify that the volunteer time I am logging is true and accurate.";

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// A sign-up for an undated ("Ongoing") activity holds a slot until the day it
// is for has passed; a dated event counts every sign-up.
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

const text = (v, max) => String(v ?? "").trim().slice(0, max);

/** Volunteer roles from the editor: [{ id, name, description, needed }]. */
export function normalizeRoles(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((r, i) => {
      let id = text(r?.id, 40) || `r${Date.now().toString(36)}${i}`;
      while (seen.has(id)) id = `${id}x`;
      seen.add(id);
      const needed = Number.parseInt(r?.needed, 10);
      return { id, name: text(r?.name, 80), description: text(r?.description, 300), needed: Number.isFinite(needed) && needed > 0 ? Math.min(needed, 999) : 0 };
    })
    .filter((r) => r.name)
    .slice(0, 20);
}

/** Create / Edit Event body. Returns { data } or { error }. */
export function parseEvent(body = {}) {
  const title = text(body.title, 120);
  if (!title) return { error: "Event name is required" };
  const description = text(body.description, 1000);
  if (!description) return { error: "Description is required" };
  const window = parseInvolvementWindow(body);
  if (window.error) return { error: window.error };
  const location = text(body.location, 120);
  if (!location) return { error: "Location is required" };
  const audience = [...new Set((Array.isArray(body.audience) ? body.audience : []).filter((a) => AUDIENCES.some((x) => x.value === a)))];
  if (!audience.length) return { error: "Choose the target audience" };
  const classRoomIds = audience.includes("CLASSROOMS") ? [...new Set((Array.isArray(body.classRoomIds) ? body.classRoomIds : []).map(String))] : [];
  if (audience.includes("CLASSROOMS") && !classRoomIds.length) return { error: "Choose the classrooms" };
  const roles = normalizeRoles(body.roles);
  if (!roles.length || roles.every((r) => !r.needed)) return { error: "Add at least one volunteer role and how many are needed" };
  return {
    data: {
      title,
      description,
      startsAt: window.start,
      endsAt: window.end,
      schedule: null,
      location,
      status: EVENT_STATUSES.some((s) => s.value === body.status) ? body.status : "ACTIVE",
      audience,
      classRoomIds,
      roles,
      capacity: roles.reduce((sum, r) => sum + r.needed, 0),
      details: text(body.details, 1000) || null,
    },
  };
}

function ageMonths(birthDate, at = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let m = (at.getFullYear() - b.getFullYear()) * 12 + (at.getMonth() - b.getMonth());
  if (at.getDate() < b.getDate()) m -= 1;
  return m;
}

/** Whether an event is meant for a family with these children ({ birthDate, classRoomId }). */
export function eventIsForChildren(activity, children) {
  const audience = activity.audience?.length ? activity.audience : ["ALL"];
  if (audience.includes("ALL")) return true;
  const at = activity.startsAt ? new Date(activity.startsAt) : new Date();
  return children.some((c) => {
    if (audience.includes("CLASSROOMS") && c.classRoomId && activity.classRoomIds?.includes(c.classRoomId)) return true;
    const months = ageMonths(c.birthDate, at);
    return months != null && AUDIENCES.some((a) => audience.includes(a.value) && a.minMonths != null && months >= a.minMonths && months <= a.maxMonths);
  });
}

/** Sign-up counts per role and in total for an activity's sign-ups ([{ roleId, parentId }]). */
export function volunteerCounts(activity, signups) {
  const roles = Array.isArray(activity.roles) ? activity.roles : [];
  return {
    filled: signups.length,
    needed: activity.capacity ?? roles.reduce((sum, r) => sum + (r.needed || 0), 0),
    roles: roles.map((r) => ({ ...r, filled: signups.filter((s) => s.roleId === r.id).length })),
  };
}

/** The parent's e-signature for logged hours, or null when it is missing. */
export function involvementSignature(input, userId) {
  const signedName = text(input?.signedName, 120);
  if (!input?.agreed || !signedName) return null;
  return { statement: INVOLVEMENT_CERTIFICATION, signedName, signedAt: new Date().toISOString(), signedById: userId };
}
