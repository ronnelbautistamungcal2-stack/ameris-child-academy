import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res, session);
    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("events/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res) {
  const { id } = req.query;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });
  return res.status(200).json(event);
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Event not found" });

  const { title, description, startDate, endDate, allDay, type, color } = req.body;

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  if (allDay !== undefined) data.allDay = allDay;
  if (type !== undefined) data.type = type;
  if (color !== undefined) data.color = color;

  const updated = await prisma.event.update({
    where: { id },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Event not found" });

  await prisma.event.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
