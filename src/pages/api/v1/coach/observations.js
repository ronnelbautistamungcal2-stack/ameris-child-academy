import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { centerId, type, teacherId } = req.query;
    if (centerId && role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const where = {};
    if (centerId) where.centerId = centerId;
    if (type && ["CAMERA", "IN_CLASS"].includes(type)) where.type = type;
    if (teacherId) where.teacherId = teacherId;

    const observations = await prisma.coachObservation.findMany({
      where,
      select: {
        id: true,
        type: true,
        date: true,
        duration: true,
        score: true,
        strengths: true,
        improvements: true,
        actionItems: true,
        notes: true,
        createdAt: true,
        coach: { select: { id: true, name: true, email: true } },
        teacher: { select: { id: true, name: true, email: true } },
        classRoom: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    return res.status(200).json(observations);
  }

  if (req.method === "POST") {
    const { centerId, teacherId, type, classRoomId, date, duration, score, strengths, improvements, actionItems, notes } = req.body;

    if (!centerId || !teacherId || !type) {
      return res.status(400).json({ error: "centerId, teacherId, and type are required" });
    }
    if (!["CAMERA", "IN_CLASS"].includes(type)) {
      return res.status(400).json({ error: "type must be CAMERA or IN_CLASS" });
    }

    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const observation = await prisma.coachObservation.create({
      data: {
        centerId,
        coachId: session.user.id,
        teacherId,
        type,
        classRoomId: classRoomId || null,
        date: date ? new Date(date) : new Date(),
        duration: duration ? parseInt(duration, 10) : null,
        score: score != null ? parseFloat(score) : null,
        strengths: strengths || null,
        improvements: improvements || null,
        actionItems: actionItems || null,
        notes: notes || null,
      },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        teacher: { select: { id: true, name: true, email: true } },
        classRoom: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(observation);
  }

  if (req.method === "PUT") {
    const { id, score, strengths, improvements, actionItems, notes } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });

    const existing = await prisma.coachObservation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Observation not found" });
    if (role !== "ADMIN" && existing.coachId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updated = await prisma.coachObservation.update({
      where: { id },
      data: {
        ...(score != null && { score: parseFloat(score) }),
        ...(strengths !== undefined && { strengths }),
        ...(improvements !== undefined && { improvements }),
        ...(actionItems !== undefined && { actionItems }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        teacher: { select: { id: true, name: true, email: true } },
        classRoom: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const existing = await prisma.coachObservation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Observation not found" });
    if (role !== "ADMIN" && existing.coachId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.coachObservation.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).end();
}
