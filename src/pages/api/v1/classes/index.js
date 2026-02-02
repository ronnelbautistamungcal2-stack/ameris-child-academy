import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId } = req.query;

  // Check center access
  if (centerId && session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const classes = await prisma.classRoom.findMany({
      where: centerId ? { centerId } : {},
      include: { children: true, teachers: { include: { teacher: true } } },
    });
    return res.status(200).json(classes);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, centerId: cId } = req.body;
    if (!name || !cId)
      return res.status(400).json({ error: "Name and centerId required" });

    const classroom = await prisma.classRoom.create({
      data: { name, centerId: cId },
      include: { children: true, teachers: true },
    });

    return res.status(201).json(classroom);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
