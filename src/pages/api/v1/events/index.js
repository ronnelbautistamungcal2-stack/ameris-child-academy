import { getSession } from "@/lib/auth";
import { parseEventDateInput } from "@/lib/calendar";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("events error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, from, to, type } = req.query;
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  const where = { centerId };

  if (from || to) {
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.OR = [{ startDate: dateFilter }, { endDate: dateFilter }];
  }

  if (type) where.type = type;

  const events = await prisma.event.findMany({
    where,
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { startDate: "asc" },
    take: 500,
  });

  return res.status(200).json(events);
}

async function handlePost(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { centerId, title, description, startDate, endDate, allDay, type, color } = req.body;

  if (!centerId || !title || !startDate || !endDate) {
    return res.status(400).json({ error: "centerId, title, startDate, and endDate are required" });
  }

  const isAllDay = allDay !== undefined ? !!allDay : true;
  const parsedStart = parseEventDateInput(startDate, isAllDay);
  const parsedEnd = parseEventDateInput(endDate, isAllDay);
  if (!parsedStart || !parsedEnd || isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return res.status(400).json({ error: "Invalid date format for startDate or endDate" });
  }
  if (parsedEnd < parsedStart) {
    return res.status(400).json({ error: "endDate cannot be before startDate" });
  }

  const event = await prisma.event.create({
    data: {
      centerId,
      title,
      description: description || null,
      startDate: parsedStart,
      endDate: parsedEnd,
      allDay: isAllDay,
      type: type || "OTHER",
      color: color || null,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return res.status(201).json(event);
}
