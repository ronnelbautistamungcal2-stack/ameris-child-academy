import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * PUT    /api/v1/character-guide/categories/:id { name?, description? }
 * DELETE /api/v1/character-guide/categories/:id   only when no behavior uses it
 * Admins only.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  const category = await prisma.characterCategory.findUnique({ where: { id: String(req.query.id) }, include: { _count: { select: { behaviors: true } } } });
  if (!category) return res.status(404).json({ error: "Category not found" });

  if (req.method === "PUT") {
    const data = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: "Category name is required" });
      const clash = await prisma.characterCategory.findFirst({ where: { id: { not: category.id }, name: { equals: name, mode: "insensitive" } } });
      if (clash) return res.status(409).json({ error: `There is already a category named ${name}` });
      data.name = name;
    }
    if (req.body?.description !== undefined) data.description = String(req.body.description || "").trim().slice(0, 500) || null;
    const updated = await prisma.characterCategory.update({ where: { id: category.id }, data });
    return res.status(200).json({ ...updated, behaviorCount: category._count.behaviors });
  }

  if (req.method === "DELETE") {
    if (category._count.behaviors) {
      return res.status(409).json({ error: `${category.name} is used by ${category._count.behaviors} behavior(s). Move or delete them first.` });
    }
    await prisma.characterCategory.delete({ where: { id: category.id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end();
}
