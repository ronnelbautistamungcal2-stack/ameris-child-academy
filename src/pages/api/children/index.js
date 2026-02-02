import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId } = req.query;

  // Only admins, teachers, and coaches can view children
  const allowedRoles = ["ADMIN", "TEACHER", "COACH"];
  if (!allowedRoles.includes(session.user.role)) {
    // Parents can only see their own children
    if (session.user.role === "PARENT") {
      const children = await prisma.child.findMany({
        where: { parentId: session.user.id },
      });
      return res.status(200).json(children);
    }
    return res.status(403).json({ error: "Forbidden" });
  }

  // Teachers/coaches must have access to the center
  if (centerId && session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const children = await prisma.child.findMany({
      where: centerId ? { centerId } : {},
      include: { progress: true, activities: true },
    });
    return res.status(200).json(children);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only admins and teachers can create children" });
    }

    const {
      firstName,
      lastName,
      birthDate,
      centerId: cId,
      classRoomId,
      parentId,
    } = req.body;
    if (!firstName || !cId) {
      return res.status(400).json({ error: "firstName and centerId required" });
    }

    const child = await prisma.child.create({
      data: {
        firstName,
        lastName,
        birthDate: birthDate ? new Date(birthDate) : null,
        centerId: cId,
        classRoomId,
        parentId,
      },
      include: { progress: true, activities: true },
    });

    return res.status(201).json(child);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
