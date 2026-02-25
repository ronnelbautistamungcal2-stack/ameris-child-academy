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
    console.error("time-off error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, userId, status } = req.query;

  const where = {};
  if (centerId) where.centerId = centerId;
  if (status) where.status = status;

  // Teachers can only see their own
  if (session.user.role === "TEACHER") {
    where.userId = session.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  const requests = await prisma.timeOffRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return res.status(200).json(requests);
}

async function handlePost(req, res, session) {
  const { centerId, type, startDate, endDate, reason } = req.body || {};
  if (!centerId || !startDate || !endDate) {
    return res.status(400).json({ error: "centerId, startDate, and endDate are required" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return res.status(400).json({ error: "endDate must be after startDate" });

  const request = await prisma.timeOffRequest.create({
    data: {
      userId: session.user.id,
      centerId,
      type: type || "PTO",
      startDate: start,
      endDate: end,
      reason: reason || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json(request);
}
