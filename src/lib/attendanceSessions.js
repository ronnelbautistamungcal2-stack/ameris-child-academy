// Several sign-ins/outs a day (client sheet 10-29 (8), rows 15/16).
//
// Each child day (Attendance) and staff day (StaffAttendance) keeps one row
// per in/out pair in AttendanceSession / StaffAttendanceSession. The day row
// stays as the summary every other screen already reads: the first in, and
// the last out (empty while the person is still in). Writers go through
// these helpers so the two never disagree.

export const SESSION_KINDS = {
  child: {
    day: "attendance",
    session: "attendanceSession",
    fk: "attendanceId",
    inField: "checkedInAt",
    outField: "checkedOutAt",
    inBy: "checkInBy",
    outBy: "checkOutBy",
  },
  staff: {
    day: "staffAttendance",
    session: "staffAttendanceSession",
    fk: "staffAttendanceId",
    inField: "clockIn",
    outField: "clockOut",
    inBy: "clockInBy",
    outBy: "clockOutBy",
  },
};

/** The day's sessions, in order. */
export function listSessions(tx, kind, dayId) {
  const k = SESSION_KINDS[kind];
  return tx[k.session].findMany({ where: { [k.fk]: dayId }, orderBy: { [k.inField]: "asc" } });
}

/**
 * Rewrites the day row's in/out from its sessions: the first in, and the last
 * out (null while the last session is still open). No sessions clears them.
 */
export async function syncDaySummary(tx, kind, dayId) {
  const k = SESSION_KINDS[kind];
  const sessions = await listSessions(tx, kind, dayId);
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  return tx[k.day].update({
    where: { id: dayId },
    data: {
      [k.inField]: first ? first[k.inField] : null,
      [k.inBy]: first ? first[k.inBy] : null,
      [k.outField]: last ? last[k.outField] : null,
      [k.outBy]: last ? last[k.outBy] : null,
    },
  });
}

/** The open session (signed in, not out yet), if any. */
export function openSession(tx, kind, dayId) {
  const k = SESSION_KINDS[kind];
  return tx[k.session].findFirst({ where: { [k.fk]: dayId, [k.outField]: null }, orderBy: { [k.inField]: "desc" } });
}

/**
 * Signs in: a new session on the day row (created with `createData` when the
 * day has none yet). Does nothing when already signed in. Returns
 * { day, changed }.
 */
export async function signIn(tx, kind, { day, createData }, at, by) {
  const k = SESSION_KINDS[kind];
  let row = day;
  if (!row) row = await tx[k.day].create({ data: { ...createData, [k.inField]: at, [k.inBy]: by } });
  else if (await openSession(tx, kind, row.id)) return { day: row, changed: false };
  await tx[k.session].create({ data: { [k.fk]: row.id, [k.inField]: at, [k.inBy]: by } });
  return { day: await syncDaySummary(tx, kind, row.id), changed: true };
}

/**
 * Signs out: closes the open session. Without one (never signed in today),
 * does nothing. Returns { day, changed }.
 */
export async function signOut(tx, kind, day, at, by) {
  const k = SESSION_KINDS[kind];
  if (!day) return { day: null, changed: false };
  const open = await openSession(tx, kind, day.id);
  if (!open) return { day, changed: false };
  await tx[k.session].update({ where: { id: open.id }, data: { [k.outField]: at, [k.outBy]: by } });
  return { day: await syncDaySummary(tx, kind, day.id), changed: true };
}

/**
 * After a screen edited the day row's in/out directly (staff attendance
 * entry, imports): makes the sessions agree. No sessions: one from the day's
 * times. Otherwise the first session takes the day's in and the last its out.
 */
export async function sessionsFromDaySummary(tx, kind, day) {
  const k = SESSION_KINDS[kind];
  if (!day?.[k.inField]) return;
  const sessions = await listSessions(tx, kind, day.id);
  if (!sessions.length) {
    await tx[k.session].create({
      data: { [k.fk]: day.id, [k.inField]: day[k.inField], [k.inBy]: day[k.inBy], [k.outField]: day[k.outField], [k.outBy]: day[k.outBy] },
    });
    return;
  }
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  await tx[k.session].update({ where: { id: first.id }, data: { [k.inField]: day[k.inField], [k.inBy]: day[k.inBy] } });
  await tx[k.session].update({ where: { id: last.id }, data: { [k.outField]: day[k.outField], [k.outBy]: day[k.outBy] } });
}
