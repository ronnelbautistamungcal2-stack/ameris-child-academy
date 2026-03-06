import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

const VALID_TYPES = ["PARENT", "CAMERA_OBSERVATION", "GENERAL"];
const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { centerId, type, status } = req.query;
    if (centerId && role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const where = {};
    if (centerId) where.centerId = centerId;
    if (type && VALID_TYPES.includes(type)) where.type = type;
    if (status && VALID_STATUSES.includes(status)) where.status = status;

    const followUps = await prisma.coachFollowUp.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        title: true,
        description: true,
        dueDate: true,
        completedAt: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return res.status(200).json(followUps);
  }

  if (req.method === "POST") {
    const { centerId, type, priority, title, description, dueDate, assignedToId, notes } = req.body;

    if (!centerId || !type || !title) {
      return res.status(400).json({ error: "centerId, type, and title are required" });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
    }

    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const followUp = await prisma.coachFollowUp.create({
      data: {
        centerId,
        createdById: session.user.id,
        type,
        priority: priority && VALID_PRIORITIES.includes(priority) ? priority : "MEDIUM",
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId: assignedToId || null,
        notes: notes || null,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(201).json(followUp);
  }

  if (req.method === "PUT") {
    const { id, status, priority, title, description, dueDate, assignedToId, notes } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });

    const existing = await prisma.coachFollowUp.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Follow-up not found" });

    const data = {};
    if (status && VALID_STATUSES.includes(status)) {
      data.status = status;
      if (status === "COMPLETED") data.completedAt = new Date();
      if (status === "OPEN" || status === "IN_PROGRESS") data.completedAt = null;
    }
    if (priority && VALID_PRIORITIES.includes(priority)) data.priority = priority;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.coachFollowUp.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const existing = await prisma.coachFollowUp.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Follow-up not found" });

    await prisma.coachFollowUp.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).end();
}
