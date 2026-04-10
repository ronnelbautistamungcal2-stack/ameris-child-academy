import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage teachers" });
  }

  if (req.method === "GET") {
    const teachers = await prisma.user.findMany({
      where: {
        OR: [
          { role: "TEACHER" },
          { roles: { has: "TEACHER" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        centers: { include: { center: true } },
        teacherClasses: { include: { classRoom: true } },
      },
    });
    return res.status(200).json(teachers);
  }

  res.setHeader("Allow", ["GET"]);
  res.status(405).end();
}
