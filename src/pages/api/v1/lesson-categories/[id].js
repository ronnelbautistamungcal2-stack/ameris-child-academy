import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage categories" });
  }

  const { id } = req.query;

  const category = await prisma.lessonCategory.findUnique({
    where: { id },
    include: { _count: { select: { lessons: true } } },
  });
  if (!category) return res.status(404).json({ error: "Category not found" });

  if (req.method === "GET") {
    return res.status(200).json(category);
  }

  if (req.method === "PUT") {
    const updates = {};
    if ("name" in req.body) updates.name = String(req.body.name).trim();
    if ("description" in req.body) updates.description = req.body.description || null;
    if ("kind" in req.body) updates.kind = req.body.kind;
    if ("groupName" in req.body) updates.groupName = req.body.groupName || null;
    if ("ageRange" in req.body) updates.ageRange = req.body.ageRange || null;
    if ("imageUrl" in req.body) updates.imageUrl = req.body.imageUrl || null;
    if ("videoUrl" in req.body) updates.videoUrl = req.body.videoUrl || null;
    if ("sortOrder" in req.body) updates.sortOrder = Number(req.body.sortOrder) || 0;

    const updated = await prisma.lessonCategory.update({
      where: { id },
      data: updates,
      include: { _count: { select: { lessons: true } } },
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    if (category._count.lessons > 0) {
      return res.status(400).json({
        error: `Cannot delete category with ${category._count.lessons} lesson(s). Remove or reassign lessons first.`,
      });
    }

    await prisma.lessonCategory.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
