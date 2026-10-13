import { accessibleCenterIds } from "@/lib/auth";
import { personInitials } from "@/lib/personNames";
import { roleLabel } from "@/lib/roles";

// Child and employee time sheets (client request 2026-10-02, Student List and
// Staff List sheets). Both are views over the daily attendance tables with the
// same shape: one row per person per day, an in and an out time, and the
// initials of whoever recorded each (the "By" columns).
//
// Admin edits keep the "By" honest (it becomes the editor's initials) and every
// edited time or deleted record is written to TimeSheetAudit with the original
// values, which the audit report lists. New rows are not audited: the client
// asked for changes and deletions only.

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
export async function loadTimeSheetAccess(prisma, session, kind, subjectId) {
  const config = TIME_SHEET_KINDS[kind];
  if (!config) return { status: 404, error: "Unknown time sheet" };
  if (!config.editorRoles.includes(session.user.role)) return { status: 403, error: "Forbidden" };

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

  const allowed = await accessibleCenterIds(session.user.id);
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

/** Time sheet rows, oldest first, optionally limited to [from, to] (local days). */
export async function listRows(prisma, kind, subject, { from, to } = {}) {
  const config = TIME_SHEET_KINDS[kind];
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
  const rows = await prisma[config.model].findMany({
    where,
    include: kind === "child" ? { classRoom: { select: { name: true } } } : undefined,
    orderBy: { [config.dayField]: "asc" },
  });

  const positions = new Map();
  if (kind === "staff" && rows.length) {
    const shifts = await prisma.shiftSchedule.findMany({
      where: { userId: subject.id, date: { gte: rows[0].date, lte: rows[rows.length - 1].date } },
      select: { date: true, position: true },
    });
    for (const shift of shifts) positions.set(startOfLocalDay(shift.date).getTime(), shift.position);
    const fallback = roleLabel(subject.role);
    for (const row of rows) {
      const key = startOfLocalDay(row.date).getTime();
      if (!positions.has(key)) positions.set(key, fallback);
    }
  }
  return rows.map((row) => serializeRow(kind, config, row, positions));
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

  const day = startOfLocalDay(parsedIn);
  const existing = await prisma[config.model].findUnique({
    where: { [config.uniqueKey]: { [config.subjectField]: subject.id, [config.dayField]: day } },
  });
  if (existing) throw new TimeSheetError(409, "There is already a time sheet row for that day. Edit it instead.");

  const data = {
    [config.subjectField]: subject.id,
    [config.dayField]: day,
    [config.inField]: parsedIn,
    [config.inByField]: editor,
    [config.outField]: parsedOut,
    [config.outByField]: parsedOut ? editor : null,
  };
  if (kind === "child") {
    data.centerId = subject.centerId;
    data.classRoomId = subject.classRoomId || null;
  } else {
    data.centerId = centerIds[0];
  }
  return prisma[config.model].create({ data });
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

/**
 * Changes a row's in and/or out time. Each time that actually changes becomes
 * one audit entry and takes the editor's initials in its By column.
 */
export async function updateRow(prisma, kind, access, recordId, { timeIn, timeOut, editor, editorUserId }) {
  const { config, subject } = access;
  const row = await loadRow(prisma, config, subject, recordId);
  const nextIn = timeIn === undefined ? row[config.inField] : parseDateTime(timeIn);
  const nextOut = timeOut === undefined ? row[config.outField] : parseDateTime(timeOut);
  validateTimes(nextIn, nextOut);
  if (!nextIn) throw new TimeSheetError(400, "A row needs a time in. Delete the row instead.");

  const same = (a, b) => (a ? a.getTime() : null) === (b ? b.getTime() : null);
  const data = {};
  const audits = [];
  const base = auditBase(kind, config, row, subject, editorUserId, editor);
  if (!same(nextIn, row[config.inField])) {
    data[config.inField] = nextIn;
    data[config.inByField] = editor;
    if (!same(startOfLocalDay(nextIn), row[config.dayField])) {
      throw new TimeSheetError(400, "The time in must stay on the same day. Delete the row and add the right day instead.");
    }
    audits.push({ ...base, action: "CHECK_IN_CHANGED", newValue: nextIn });
  }
  if (!same(nextOut, row[config.outField])) {
    data[config.outField] = nextOut;
    data[config.outByField] = nextOut ? editor : null;
    audits.push({ ...base, action: "CHECK_OUT_CHANGED", newValue: nextOut });
  }
  if (!audits.length) return row;

  const [updated] = await prisma.$transaction([
    prisma[config.model].update({ where: { id: row.id }, data }),
    ...audits.map((entry) => prisma.timeSheetAudit.create({ data: entry })),
  ]);
  return updated;
}

/** Deletes a row and records it on the audit report. */
export async function deleteRow(prisma, kind, access, recordId, { editor, editorUserId }) {
  const { config, subject } = access;
  const row = await loadRow(prisma, config, subject, recordId);
  await prisma.$transaction([
    prisma.timeSheetAudit.create({
      data: { ...auditBase(kind, config, row, subject, editorUserId, editor), action: "DELETED", newValue: null },
    }),
    prisma[config.model].delete({ where: { id: row.id } }),
  ]);
}

export async function listAudit(prisma, kind, subject) {
  const entries = await prisma.timeSheetAudit.findMany({
    where: kind === "child" ? { kind, childId: subject.id } : { kind, userId: subject.id },
    orderBy: [{ day: "asc" }, { changedAt: "asc" }],
  });
  return entries.map(({ childId, userId, centerId, changedById, ...entry }) => entry);
}
