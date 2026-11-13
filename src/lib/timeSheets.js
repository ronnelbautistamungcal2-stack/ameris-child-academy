import { accessibleCenterIds } from "@/lib/auth";
import { personInitials } from "@/lib/personNames";
import { roleLabel } from "@/lib/roles";
import { SESSION_KINDS, syncDaySummary } from "@/lib/attendanceSessions";

// Child and employee time sheets (client request 2026-10-02, Student List and
// Staff List sheets). Both are views over the daily attendance tables with the
// same shape: one row per person per day, an in and an out time, and the
// initials of whoever recorded each (the "By" columns).
//
// Admin edits keep the "By" honest (it becomes the editor's initials) and every
// edited time or deleted record is written to TimeSheetAudit with the original
// values, which the audit report lists. New rows, and filling in a time that
// was blank, are not audited: the client asked for changes to existing times
// and deletions only (answered 2026-10-19), on whichever screen they happen.

export const TIME_SHEET_KINDS = {
  child: {
    model: "attendance",
    subjectField: "childId",
    dayField: "day",
    inField: "checkedInAt",
    outField: "checkedOutAt",
    inByField: "checkInBy",
    outByField: "checkOutBy",
    uniqueKey: "childId_day",
    // The client asked for admins to manage child time sheets.
    editorRoles: ["ADMIN"],
  },
  staff: {
    model: "staffAttendance",
    subjectField: "userId",
    dayField: "date",
    inField: "clockIn",
    outField: "clockOut",
    inByField: "clockInBy",
    outByField: "clockOutBy",
    uniqueKey: "userId_date",
    // Admin and coach changes go on the audit; HR has the same page as admin.
    editorRoles: ["ADMIN", "COACH", "HR_STAFF"],
  },
};

export function startOfLocalDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateTime(value) {
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Loads the subject (child or user) and checks the session may edit its time
 * sheet. Coaches and HR are limited to their own centers.
 * Returns { config, subject, centerIds } or { status, error }.
 */
export async function loadTimeSheetAccess(prisma, session, kind, subjectId, { allowSelfRead = false } = {}) {
  const config = TIME_SHEET_KINDS[kind];
  if (!config) return { status: 404, error: "Unknown time sheet" };
  // Employees can read (and e-sign) their own time sheet.
  const selfRead = allowSelfRead && kind === "staff" && String(subjectId) === session.user.id;
  if (!selfRead && !config.editorRoles.includes(session.user.role)) return { status: 403, error: "Forbidden" };

  let subject;
  let subjectCenterIds;
  if (kind === "child") {
    subject = await prisma.child.findUnique({
      where: { id: String(subjectId) },
      include: {
        parent: { select: { name: true } },
        guardians: { include: { guardian: { select: { name: true } } } },
        center: { select: { name: true } },
      },
    });
    subjectCenterIds = subject ? [subject.centerId] : [];
  } else {
    subject = await prisma.user.findUnique({
      where: { id: String(subjectId) },
      select: {
        id: true,
        name: true,
        middleInitial: true,
        email: true,
        role: true,
        roles: true,
        centers: { select: { centerId: true } },
      },
    });
    subjectCenterIds = subject ? subject.centers.map((c) => c.centerId) : [];
  }
  if (!subject) return { status: 404, error: "Not found" };

  const allowed = selfRead ? null : await accessibleCenterIds(session.user.id);
  if (allowed && !subjectCenterIds.some((id) => allowed.includes(id))) {
    return { status: 403, error: "Forbidden" };
  }
  return { config, subject, centerIds: subjectCenterIds };
}

/** Initials of the signed-in editor, for the By columns and the audit. */
export async function editorInitials(prisma, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, middleInitial: true } });
  return personInitials(user) || "?";
}

export function describeSubject(kind, subject) {
  if (kind === "child") {
    const parents = [subject.parent?.name, ...(subject.guardians || []).map((g) => g.guardian?.name)]
      .filter(Boolean)
      .filter((name, i, all) => all.indexOf(name) === i);
    return {
      id: subject.id,
      name: [subject.firstName, subject.lastName].filter(Boolean).join(" "),
      birthDate: subject.birthDate || null,
      parents,
      centerName: subject.center?.name || null,
    };
  }
  return { id: subject.id, name: subject.name || subject.email, role: roleLabel(subject.role) };
}

function serializeRow(kind, config, row, positions) {
  return {
    id: row.id,
    day: row[config.dayField],
    timeIn: row[config.inField],
    inBy: row[config.inByField],
    timeOut: row[config.outField],
    outBy: row[config.outByField],
    // Classroom for children; the day's scheduled position for staff.
    label: kind === "child" ? row.classRoom?.name || null : positions.get(startOfLocalDay(row.date).getTime()) || null,
  };
}

/**
 * Time sheet rows, oldest first, optionally limited to [from, to] (local
 * days). One row per sign-in session, so several ins and outs on a day all
 * show (client sheet 10-29 (8), rows 15/16); a day with no sessions shows its
 * own times.
 */
export async function listRows(prisma, kind, subject, { from, to } = {}) {
  const config = TIME_SHEET_KINDS[kind];
  const sk = SESSION_KINDS[kind];
  const where = { [config.subjectField]: subject.id };
  if (from || to) {
    where[config.dayField] = {};
    if (from) where[config.dayField].gte = startOfLocalDay(from);
    if (to) {
      const end = startOfLocalDay(to);
      end.setDate(end.getDate() + 1);
      where[config.dayField].lt = end;
    }
  }
  const days = await prisma[config.model].findMany({
    where,
    include: {
      ...(kind === "child" ? { classRoom: { select: { name: true } } } : {}),
      sessions: { orderBy: { [sk.inField]: "asc" } },
    },
    orderBy: { [config.dayField]: "asc" },
  });

  const positions = new Map();
  if (kind === "staff" && days.length) {
    const shifts = await prisma.shiftSchedule.findMany({
      where: { userId: subject.id, date: { gte: days[0].date, lte: days[days.length - 1].date } },
      select: { date: true, position: true },
    });
    for (const shift of shifts) positions.set(startOfLocalDay(shift.date).getTime(), shift.position);
    const fallback = roleLabel(subject.role);
    for (const day of days) {
      const key = startOfLocalDay(day.date).getTime();
      if (!positions.has(key)) positions.set(key, fallback);
    }
  }
  const rows = [];
  for (const day of days) {
    if (!day.sessions.length) {
      rows.push(serializeRow(kind, config, day, positions));
      continue;
    }
    for (const session of day.sessions) {
      rows.push({ ...serializeRow(kind, config, { ...day, ...pickTimes(sk, session) }, positions), id: session.id });
    }
  }
  return rows;
}

/** A session's in/out/by fields, under the day row's field names. */
function pickTimes(sk, session) {
  return { [sk.inField]: session[sk.inField], [sk.outField]: session[sk.outField], [sk.inBy]: session[sk.inBy], [sk.outBy]: session[sk.outBy] };
}

export class TimeSheetError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateTimes(timeIn, timeOut) {
  if (timeIn === undefined || timeOut === undefined) throw new TimeSheetError(400, "Enter valid dates and times");
  if (timeIn && timeOut && timeOut < timeIn) throw new TimeSheetError(400, "The time out must be after the time in");
}

/** Adds a missing day (the blank row at the bottom of the time sheet). Not audited. */
export async function createRow(prisma, kind, access, { timeIn, timeOut, editor }) {
  const { config, subject, centerIds } = access;
  const parsedIn = parseDateTime(timeIn);
  const parsedOut = timeOut ? parseDateTime(timeOut) : null;
  if (!parsedIn) throw new TimeSheetError(400, "Enter the date and time in");
  validateTimes(parsedIn, parsedOut);

  if (parsedOut && !sameTime(startOfLocalDay(parsedOut), startOfLocalDay(parsedIn))) {
    throw new TimeSheetError(400, "The time out must be on the same day as the time in");
  }
  const sk = SESSION_KINDS[kind];
  const day = startOfLocalDay(parsedIn);
  // A day can have several sessions now: a new row adds one to the day.
  return prisma.$transaction(async (tx) => {
    let dayRow = await tx[config.model].findUnique({
      where: { [config.uniqueKey]: { [config.subjectField]: subject.id, [config.dayField]: day } },
    });
    if (!dayRow) {
      const data = { [config.subjectField]: subject.id, [config.dayField]: day };
      if (kind === "child") {
        data.centerId = subject.centerId;
        data.classRoomId = subject.classRoomId || null;
      } else {
        data.centerId = centerIds[0];
      }
      dayRow = await tx[config.model].create({ data });
    }
    const session = await tx[sk.session].create({
      data: { [sk.fk]: dayRow.id, [sk.inField]: parsedIn, [sk.inBy]: editor, [sk.outField]: parsedOut, [sk.outBy]: parsedOut ? editor : null },
    });
    await syncDaySummary(tx, kind, dayRow.id);
    return { ...session, id: session.id };
  });
}

async function loadRow(prisma, config, subject, recordId) {
  const row = await prisma[config.model].findUnique({ where: { id: String(recordId) } });
  if (!row || row[config.subjectField] !== subject.id) throw new TimeSheetError(404, "Time sheet row not found");
  return row;
}

function auditBase(kind, config, row, subject, editorUserId, editor) {
  return {
    kind,
    centerId: row.centerId,
    childId: kind === "child" ? subject.id : null,
    userId: kind === "staff" ? subject.id : null,
    recordId: row.id,
    day: row[config.dayField],
    originalIn: row[config.inField],
    originalInBy: row[config.inByField],
    originalOut: row[config.outField],
    originalOutBy: row[config.outByField],
    changedById: editorUserId,
    changedByInitials: editor,
  };
}

const sameTime = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

/**
 * Audit entries for an existing row whose times are about to change. A time
 * that was blank and is now filled in is not an audited change. Pass
 * undefined for a time that is not being changed. Used by the time sheets and
 * by every other screen that edits staff or child times.
 */
export function timeChangeAudits(kind, row, { nextIn, nextOut }, { editor, editorUserId }) {
  const config = TIME_SHEET_KINDS[kind];
  const base = auditBase(kind, config, row, { id: row[config.subjectField] }, editorUserId, editor);
  const audits = [];
  if (nextIn !== undefined && row[config.inField] && !sameTime(nextIn, row[config.inField])) {
    audits.push({ ...base, action: "CHECK_IN_CHANGED", newValue: nextIn });
  }
  if (nextOut !== undefined && row[config.outField] && !sameTime(nextOut, row[config.outField])) {
    audits.push({ ...base, action: "CHECK_OUT_CHANGED", newValue: nextOut });
  }
  return audits;
}

/**
 * Changes a row's in and/or out time. Each time that actually changes takes
 * the editor's initials in its By column; changes to existing times are
 * audited.
 */
export async function updateRow(prisma, kind, access, recordId, { timeIn, timeOut, editor, editorUserId }) {
  const { config, subject } = access;
  const session = await loadSession(prisma, kind, config, subject, recordId);
  if (session) return updateSession(prisma, kind, config, session, { timeIn, timeOut, editor, editorUserId });
  const row = await loadRow(prisma, config, subject, recordId);
  const nextIn = timeIn === undefined ? row[config.inField] : parseDateTime(timeIn);
  const nextOut = timeOut === undefined ? row[config.outField] : parseDateTime(timeOut);
  validateTimes(nextIn, nextOut);
  if (!nextIn) throw new TimeSheetError(400, "A row needs a time in. Delete the row instead.");

  const data = {};
  if (!sameTime(nextIn, row[config.inField])) {
    data[config.inField] = nextIn;
    data[config.inByField] = editor;
    if (!sameTime(startOfLocalDay(nextIn), row[config.dayField])) {
      throw new TimeSheetError(400, "The time in must stay on the same day. Delete the row and add the right day instead.");
    }
  }
  if (!sameTime(nextOut, row[config.outField])) {
    data[config.outField] = nextOut;
    data[config.outByField] = nextOut ? editor : null;
  }
  if (!Object.keys(data).length) return row;
  const audits = timeChangeAudits(kind, row, { nextIn, nextOut }, { editor, editorUserId });

  const [updated] = await prisma.$transaction([
    prisma[config.model].update({ where: { id: row.id }, data }),
    ...audits.map((entry) => prisma.timeSheetAudit.create({ data: entry })),
  ]);
  return updated;
}

/** Deletes a row and records it on the audit report. */
export async function deleteRow(prisma, kind, access, recordId, { editor, editorUserId }) {
  const { config, subject } = access;
  const session = await loadSession(prisma, kind, config, subject, recordId);
  if (session) return deleteSession(prisma, kind, config, session, { editor, editorUserId });
  const row = await loadRow(prisma, config, subject, recordId);
  await prisma.$transaction([
    prisma.timeSheetAudit.create({
      data: { ...auditBase(kind, config, row, subject, editorUserId, editor), action: "DELETED", newValue: null },
    }),
    prisma[config.model].delete({ where: { id: row.id } }),
  ]);
}

/** The sign-in session with this id for this subject, or null when the id is a day row. */
async function loadSession(prisma, kind, config, subject, recordId) {
  const sk = SESSION_KINDS[kind];
  const session = await prisma[sk.session].findUnique({ where: { id: String(recordId) }, include: { [sk.day]: true } });
  if (!session) return null;
  if (session[sk.day][config.subjectField] !== subject.id) throw new TimeSheetError(404, "Time sheet row not found");
  return session;
}

/** The session's times as a day-shaped row, for the audit entries. */
function sessionAsRow(kind, session) {
  const sk = SESSION_KINDS[kind];
  return { ...session[sk.day], id: session.id, ...pickTimes(sk, session) };
}

async function updateSession(prisma, kind, config, session, { timeIn, timeOut, editor, editorUserId }) {
  const sk = SESSION_KINDS[kind];
  const day = session[sk.day];
  const row = sessionAsRow(kind, session);
  const nextIn = timeIn === undefined ? session[sk.inField] : parseDateTime(timeIn);
  const nextOut = timeOut === undefined ? session[sk.outField] : parseDateTime(timeOut);
  validateTimes(nextIn, nextOut);
  if (!nextIn) throw new TimeSheetError(400, "A row needs a time in. Delete the row instead.");
  if (!sameTime(startOfLocalDay(nextIn), day[config.dayField])) {
    throw new TimeSheetError(400, "The time in must stay on the same day. Delete the row and add the right day instead.");
  }
  const data = {};
  if (!sameTime(nextIn, session[sk.inField])) {
    data[sk.inField] = nextIn;
    data[sk.inBy] = editor;
  }
  if (!sameTime(nextOut, session[sk.outField])) {
    data[sk.outField] = nextOut;
    data[sk.outBy] = nextOut ? editor : null;
  }
  if (!Object.keys(data).length) return row;
  const audits = timeChangeAudits(kind, row, { nextIn, nextOut }, { editor, editorUserId });
  return prisma.$transaction(async (tx) => {
    const updated = await tx[sk.session].update({ where: { id: session.id }, data });
    for (const entry of audits) await tx.timeSheetAudit.create({ data: entry });
    await syncDaySummary(tx, kind, day.id);
    return updated;
  });
}

/** Deletes a session (and the day when it was the last one); audited. */
async function deleteSession(prisma, kind, config, session, { editor, editorUserId }) {
  const sk = SESSION_KINDS[kind];
  const day = session[sk.day];
  const row = sessionAsRow(kind, session);
  await prisma.$transaction(async (tx) => {
    await tx.timeSheetAudit.create({
      data: { ...auditBase(kind, config, row, { id: day[config.subjectField] }, editorUserId, editor), action: "DELETED", newValue: null },
    });
    await tx[sk.session].delete({ where: { id: session.id } });
    const left = await tx[sk.session].count({ where: { [sk.fk]: day.id } });
    if (left) await syncDaySummary(tx, kind, day.id);
    else await tx[config.model].delete({ where: { id: day.id } });
  });
}

export async function listAudit(prisma, kind, subject) {
  const entries = await prisma.timeSheetAudit.findMany({
    where: kind === "child" ? { kind, childId: subject.id } : { kind, userId: subject.id },
    orderBy: [{ day: "asc" }, { changedAt: "asc" }],
  });
  return entries.map(({ childId, userId, centerId, changedById, ...entry }) => entry);
}
