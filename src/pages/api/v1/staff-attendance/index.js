import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("staff-attendance error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, userId, from, to, date } = req.query;

  const where = {};
  if (centerId) where.centerId = centerId;
  if (userId) where.userId = userId;
  if (session.user.role === "TEACHER") where.userId = session.user.id;

  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where.date = { gte: d, lt: next };
  } else {
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    if (from || to) where.date = dateFilter;
  }

  const records = await prisma.staffAttendance.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      recordedBy: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return res.status(200).json(records);
}

async function handlePost(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can record staff attendance" });
  }

  const { userId, centerId, date, clockIn, clockOut, status, lateMinutes, notes } = req.body || {};
  if (!userId || !centerId || !date) {
    return res.status(400).json({ error: "userId, centerId, and date are required" });
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const record = await prisma.staffAttendance.upsert({
    where: { userId_date: { userId, date: d } },
    update: {
      clockIn: clockIn ? new Date(clockIn) : undefined,
      clockOut: clockOut ? new Date(clockOut) : undefined,
      status: status || undefined,
      lateMinutes: typeof lateMinutes === "number" ? lateMinutes : undefined,
      notes: notes !== undefined ? notes : undefined,
      recordedById: session.user.id,
    },
    create: {
      userId,
      centerId,
      date: d,
      clockIn: clockIn ? new Date(clockIn) : null,
      clockOut: clockOut ? new Date(clockOut) : null,
      status: status || "PRESENT",
      lateMinutes: lateMinutes || 0,
      notes: notes || null,
      recordedById: session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json(record);
}
