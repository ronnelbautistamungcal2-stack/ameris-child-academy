import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

  const shiftUserFilter = session.user.role === "TEACHER" ? { userId: session.user.id } : {};
  const timeOffUserFilter = session.user.role === "TEACHER" ? { userId: session.user.id } : {};
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

  const [events, shifts, timeOff, pendingTimeOff] = await Promise.all([
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
  ]);

  return res.status(200).json({ events, shifts, timeOff, pendingTimeOff });
}
