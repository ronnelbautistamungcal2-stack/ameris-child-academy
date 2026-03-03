import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res, session);
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("shifts/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  const existing = await prisma.shiftSchedule.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Shift not found" });

  const { userId, date, startTime, endTime, position, notes } = req.body;

  const data = {};
  if (userId !== undefined) data.userId = userId;
  if (date !== undefined) data.date = new Date(date);
  if (startTime !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(startTime)) return res.status(400).json({ error: "startTime must be HH:MM" });
    data.startTime = startTime;
  }
  if (endTime !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(endTime)) return res.status(400).json({ error: "endTime must be HH:MM" });
    data.endTime = endTime;
  }
  if (position !== undefined) data.position = position;
  if (notes !== undefined) data.notes = notes;

  const updated = await prisma.shiftSchedule.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  const existing = await prisma.shiftSchedule.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Shift not found" });

  await prisma.shiftSchedule.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
