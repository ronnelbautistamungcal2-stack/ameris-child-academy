import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { centerId } = req.query;

  if (req.method === "GET") {
    if (!centerId) {
      return res.status(400).json({ error: "centerId is required" });
    }

    if (session.user.role !== "ADMIN") {
      const hasAccess = await hasAccessToCenter(session.user.id, centerId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const remediations = await prisma.lessonRemediation.findMany({
      where: {
        fromLesson: { centerId },
      },
      include: {
        fromLesson: { select: { id: true, title: true, category: { select: { name: true } } } },
        toLesson: { select: { id: true, title: true, category: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(remediations);
  }

  res.setHeader("Allow", ["GET"]);
  res.status(405).end();
}
