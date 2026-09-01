import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES, isEmployeeRole, isNonAdminEmployeeRole } from "@/lib/roles";

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getBirthdayOccurrences(user, from, to) {
  if (!user.dob || !from || !to) return [];
  const dob = new Date(user.dob);
  if (Number.isNaN(dob.getTime())) return [];

  const month = dob.getUTCMonth();
  const day = dob.getUTCDate();
  const dobYear = dob.getUTCFullYear();
  const occurrences = [];

  for (let year = from.getUTCFullYear() - 1; year <= to.getUTCFullYear() + 1; year++) {
    if (year < dobYear) continue;
    const occDay = month === 1 && day === 29 && !isLeapYear(year) ? 28 : day;
    const occDate = new Date(Date.UTC(year, month, occDay, 12, 0, 0, 0));
    if (occDate >= from && occDate <= to) {
      occurrences.push({
        id: `birthday-${user.id}-${year}`,
        user: { id: user.id, name: user.name },
        date: occDate.toISOString(),
        age: year - dobYear,
      });
    }
  }
  return occurrences;
}

function buildRangeFilter(startField, endField, from, to) {
  if (from && to) {
    return {
      AND: [
        { [startField]: { lte: to } },
        { [endField]: { gte: from } },
      ],
    };
  }
  if (from) {
    return { [endField]: { gte: from } };
  }
  if (to) {
    return { [startField]: { lte: to } };
  }
  return {};
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") return handleGet(req, res, session);
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  } catch (e) {
    console.error("calendar error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, from, to } = req.query;
  if (!centerId) return res.status(400).json({ error: "centerId is required" });
  if (session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  let parsedFrom = null;
  let parsedTo = null;
  if (from) {
    parsedFrom = new Date(from);
    if (isNaN(parsedFrom.getTime())) return res.status(400).json({ error: "Invalid 'from' date format" });
  }
  if (to) {
    parsedTo = new Date(to);
    if (isNaN(parsedTo.getTime())) return res.status(400).json({ error: "Invalid 'to' date format" });
  }

  const shiftUserFilter = isNonAdminEmployeeRole(session.user.role)
    ? { userId: session.user.id }
    : {};
  const timeOffUserFilter = isNonAdminEmployeeRole(session.user.role)
    ? { userId: session.user.id }
    : {};
  const eventRangeFilter = buildRangeFilter("startDate", "endDate", parsedFrom, parsedTo);
  const timeOffRangeFilter = buildRangeFilter("startDate", "endDate", parsedFrom, parsedTo);
  const shiftDateFilter =
    parsedFrom && parsedTo
      ? { date: { gte: parsedFrom, lte: parsedTo } }
      : parsedFrom
        ? { date: { gte: parsedFrom } }
        : parsedTo
          ? { date: { lte: parsedTo } }
          : {};
  const baseTimeOffWhere = {
    centerId,
    ...timeOffUserFilter,
    ...timeOffRangeFilter,
  };

  const [events, shifts, timeOff, pendingTimeOff, staffWithBirthdays] = await Promise.all([
    prisma.event.findMany({
      where: {
        centerId,
        ...eventRangeFilter,
      },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
      take: 500,
    }),
    prisma.shiftSchedule.findMany({
      where: {
        centerId,
        ...shiftUserFilter,
        ...shiftDateFilter,
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 500,
    }),
    prisma.timeOffRequest.findMany({
      where: {
        ...baseTimeOffWhere,
        status: "APPROVED",
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
      take: 500,
    }),
    session.user.role === "ADMIN"
      ? prisma.timeOffRequest.findMany({
          where: {
            ...baseTimeOffWhere,
            status: "PENDING",
          },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { startDate: "asc" },
          take: 500,
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: {
        centers: { some: { centerId } },
        dob: { not: null },
        OR: [
          { role: { in: EMPLOYEE_ROLES } },
          { roles: { hasSome: EMPLOYEE_ROLES } },
        ],
      },
      select: { id: true, name: true, dob: true },
    }),
  ]);

  const birthdays = parsedFrom && parsedTo
    ? staffWithBirthdays.flatMap((user) => getBirthdayOccurrences(user, parsedFrom, parsedTo))
    : [];

  return res.status(200).json({ events, shifts, timeOff, pendingTimeOff, birthdays });
}
