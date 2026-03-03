import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasDateFilter = from || to;

  const shiftUserFilter = session.user.role === "TEACHER" ? { userId: session.user.id } : {};
  const timeOffUserFilter = session.user.role === "TEACHER" ? { userId: session.user.id } : {};

  const [events, shifts, timeOff] = await Promise.all([
    prisma.event.findMany({
      where: {
        centerId,
        ...(hasDateFilter ? { OR: [{ startDate: dateFilter }, { endDate: dateFilter }] } : {}),
      },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
      take: 500,
    }),
    prisma.shiftSchedule.findMany({
      where: {
        centerId,
        ...(hasDateFilter ? { date: dateFilter } : {}),
        ...shiftUserFilter,
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 500,
    }),
    prisma.timeOffRequest.findMany({
      where: {
        centerId,
        status: { in: ["APPROVED", "PENDING"] },
        ...(hasDateFilter ? { OR: [{ startDate: dateFilter }, { endDate: dateFilter }] } : {}),
        ...timeOffUserFilter,
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
      take: 500,
    }),
  ]);

  return res.status(200).json({ events, shifts, timeOff });
}
