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
    if (!centerId && session.user.role !== "ADMIN") {
      return res.status(400).json({ error: "centerId is required" });
    }

    if (centerId && session.user.role !== "ADMIN") {
      const hasAccess = await hasAccessToCenter(session.user.id, centerId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const categories = await prisma.lessonCategory.findMany({
      where: centerId ? { centerId } : {},
      include: { _count: { select: { lessons: true } } },
      orderBy: { sortOrder: "asc" },
    });

    return res.status(200).json(categories);
  }

  if (req.method === "POST") {
    if (!["ADMIN"].includes(session.user.role)) {
      return res.status(403).json({ error: "Only admins can create categories" });
    }

    const { centerId: cId, name, description, kind, groupName, ageRange, imageUrl, videoUrl, sortOrder } = req.body;
    if (!cId || !name) {
      return res.status(400).json({ error: "centerId and name are required" });
    }

    const category = await prisma.lessonCategory.create({
      data: {
        centerId: cId,
        name: name.trim(),
        description: description || null,
        kind: kind || "PACKAGE",
        groupName: groupName || null,
        ageRange: ageRange || null,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        sortOrder: sortOrder != null ? Number(sortOrder) : 0,
      },
      include: { _count: { select: { lessons: true } } },
    });

    return res.status(201).json(category);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
