import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole, isNonAdminEmployeeRole } from "@/lib/roles";
import {
  decorateTimeOffRequest,
  normalizeTimeOffType,
} from "@/lib/time-off";

function applyRequestDateRange(where, from, to) {
  const startDate = from ? new Date(from) : null;
  const endDate = to ? new Date(to) : null;
  if (!startDate && !endDate) return;

  if (startDate && endDate) {
    where.startDate = { lte: endDate };
    where.endDate = { gte: startDate };
    return;
  }

  if (startDate) {
    where.endDate = { gte: startDate };
    return;
  }

  where.startDate = { lte: endDate };
}

function applySubmittedRange(where, submittedFrom, submittedTo) {
  if (!submittedFrom && !submittedTo) return;
  where.createdAt = {};
  if (submittedFrom) where.createdAt.gte = new Date(submittedFrom);
  if (submittedTo) {
    const end = new Date(submittedTo);
    end.setHours(23, 59, 59, 999);
    where.createdAt.lte = end;
  }
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Only employees can access time off" });
    }

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
  const { centerId, userId, status, from, to, submittedFrom, submittedTo } = req.query;
  if (centerId && session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const where = {};
  if (centerId) where.centerId = centerId;
  if (status) where.status = status;
  applyRequestDateRange(where, from, to);
  applySubmittedRange(where, submittedFrom, submittedTo);

  if (isNonAdminEmployeeRole(session.user.role)) {
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
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return res.status(200).json(requests.map(decorateTimeOffRequest));
}

async function handlePost(req, res, session) {
  const { centerId, type, startDate, endDate, reason } = req.body || {};
  if (!centerId || !startDate || !endDate) {
    return res.status(400).json({ error: "centerId, startDate, and endDate are required" });
  }
  if (session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return res.status(400).json({ error: "endDate must be after startDate" });

  const request = await prisma.timeOffRequest.create({
    data: {
      userId: session.user.id,
      centerId,
      type: normalizeTimeOffType(type),
      startDate: start,
      endDate: end,
      reason: reason || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json(decorateTimeOffRequest(request));
}
