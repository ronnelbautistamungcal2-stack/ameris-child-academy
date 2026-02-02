import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const child = await prisma.child.findUnique({
      where: { id },
      include: {
        progress: { include: { lesson: true } },
        activities: true,
        parent: true,
      },
    });
    if (!child) return res.status(404).json({ error: "Child not found" });

    // Parent can only see their own child
    if (session.user.role === "PARENT" && child.parentId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(child);
  }

  if (req.method === "PUT") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { firstName, lastName, birthDate, classRoomId } = req.body;
    const child = await prisma.child.update({
      where: { id },
      data: {
        firstName,
        lastName,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        classRoomId,
      },
      include: { progress: true, activities: true },
    });

    return res.status(200).json(child);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete children" });
    }

    await prisma.child.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
