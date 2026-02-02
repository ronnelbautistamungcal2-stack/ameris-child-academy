import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const classroom = await prisma.classRoom.findUnique({
      where: { id },
      include: { children: true, teachers: { include: { teacher: true } } },
    });
    if (!classroom) return res.status(404).json({ error: "Class not found" });
    return res.status(200).json(classroom);
  }

  if (req.method === "PUT") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name } = req.body;
    const classroom = await prisma.classRoom.update({
      where: { id },
      data: { name },
      include: { children: true, teachers: true },
    });

    return res.status(200).json(classroom);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete classes" });
    }

    await prisma.classRoom.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
