import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId } = req.query;

  if (req.method === "GET") {
    // Teachers/admins/coaches can view lessons
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (centerId && session.user.role !== "ADMIN") {
      const hasAccess = await hasAccessToCenter(session.user.id, centerId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const lessons = await prisma.lesson.findMany({
      where: centerId ? { centerId } : {},
      include: {
        category: true,
        goals: { orderBy: { goalIndex: "asc" } },
        remediationsFrom: { include: { toLesson: true } },
      },
    });
    return res.status(200).json(lessons);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { title, description, centerId: cId, media } = req.body;
    if (!title || !cId)
      return res.status(400).json({ error: "Title and centerId required" });

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        centerId: cId,
        media: media || [],
      },
      include: {
        category: true,
        goals: { orderBy: { goalIndex: "asc" } },
        remediationsFrom: { include: { toLesson: true } },
      },
    });

    return res.status(201).json(lesson);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
