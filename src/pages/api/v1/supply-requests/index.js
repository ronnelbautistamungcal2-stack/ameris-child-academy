import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole, isNonAdminEmployeeRole } from "@/lib/roles";

const VALID_STATUSES = ["PENDING", "APPROVED", "FULFILLED", "DENIED"];

const SUPPLY_REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, name: true, email: true } },
  classRoom: { select: { id: true, name: true } },
  lesson: { select: { id: true, title: true } },
};

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Only staff can access supply requests" });
    }

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("supply-requests error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, classRoomId, status } = req.query;
  if (centerId && session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const where = {};
  if (centerId) where.centerId = centerId;
  if (classRoomId) where.classRoomId = classRoomId;
  if (status) where.status = status;

  if (isNonAdminEmployeeRole(session.user.role)) {
    where.requestedById = session.user.id;
  }

  const requests = await prisma.supplyRequest.findMany({
    where,
    include: SUPPLY_REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return res.status(200).json(requests);
}

async function handlePost(req, res, session) {
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Only admins and teachers can request supplies" });
  }

  const { centerId, classRoomId, item, quantity, purpose, notes, lessonId, status } = req.body || {};
  if (!centerId || !item || !String(item).trim()) {
    return res.status(400).json({ error: "centerId and item are required" });
  }

  if (session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const request = await prisma.supplyRequest.create({
    data: {
      centerId,
      classRoomId: classRoomId || null,
      item: String(item).trim(),
      quantity: Number(quantity) > 0 ? Math.floor(Number(quantity)) : 1,
      purpose: purpose || null,
      notes: notes || null,
      lessonId: lessonId || null,
      requestedById: session.user.id,
      // Admins manually logging a supply can mark it already approved/fulfilled.
      status: session.user.role === "ADMIN" && VALID_STATUSES.includes(status) ? status : "PENDING",
    },
    include: SUPPLY_REQUEST_INCLUDE,
  });

  return res.status(201).json(request);
}
