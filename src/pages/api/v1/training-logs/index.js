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
    console.error("training-logs error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, userId, category, from, to } = req.query;

  const where = {};
  if (centerId) where.centerId = centerId;
  if (category) where.category = category;

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

  const logs = await prisma.trainingLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      recordedBy: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return res.status(200).json(logs);
}

async function handlePost(req, res, session) {
  const { centerId, topic, description, hours, date, category, certificateUrl, certificateFileName } = req.body || {};
  if (!centerId || !topic || !hours || !date) {
    return res.status(400).json({ error: "centerId, topic, hours, and date are required" });
  }

  const log = await prisma.trainingLog.create({
    data: {
      userId: session.user.role === "TEACHER" ? session.user.id : (req.body.userId || session.user.id),
      centerId,
      topic,
      description: description || null,
      hours: parseFloat(hours),
      date: new Date(date),
      category: category || "Other",
      certificateUrl: certificateUrl || null,
      certificateFileName: certificateFileName || null,
      recordedById: session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json(log);
}
