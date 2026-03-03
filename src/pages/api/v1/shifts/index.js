import { getSession } from "@/lib/auth";
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
    console.error("shifts error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, from, to, userId } = req.query;
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  const where = { centerId };

  if (session.user.role === "TEACHER") {
    where.userId = session.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  if (from || to) {
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.date = dateFilter;
  }

  const shifts = await prisma.shiftSchedule.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 500,
  });

  return res.status(200).json(shifts);
}

async function handlePost(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { centerId, userId, date, startTime, endTime, position, notes } = req.body;

  if (!centerId || !userId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: "centerId, userId, date, startTime, and endTime are required" });
  }

  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return res.status(400).json({ error: "startTime and endTime must be in HH:MM format" });
  }

  const shift = await prisma.shiftSchedule.create({
    data: {
      centerId,
      userId,
      date: new Date(date),
      startTime,
      endTime,
      position: position || "Teacher",
      notes: notes || null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return res.status(201).json(shift);
}
