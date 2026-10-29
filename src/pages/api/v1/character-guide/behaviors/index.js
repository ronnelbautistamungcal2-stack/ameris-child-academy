import { getSession } from "@/lib/auth";
import { parseBehavior } from "@/lib/characterGuide";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES, hasAnyRole } from "@/lib/roles";

export const BEHAVIOR_INCLUDE = { category: { select: { id: true, name: true } } };

/**
 * GET  /api/v1/character-guide/behaviors[?type=&categoryId=&q=]   staff (with trees)
 * POST /api/v1/character-guide/behaviors { type, name, categoryId, level, description, tree }   admins
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!hasAnyRole(session.user, EMPLOYEE_ROLES)) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const q = String(req.query.q || "").trim();
    const rows = await prisma.characterBehavior.findMany({
      where: {
        ...(req.query.type ? { type: String(req.query.type) } : {}),
        ...(req.query.categoryId ? { categoryId: String(req.query.categoryId) } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
      },
      include: BEHAVIOR_INCLUDE,
      orderBy: [{ updatedAt: "desc" }],
    });
    return res.status(200).json(rows);
  }

  if (req.method === "POST") {
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    const parsed = parseBehavior(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!(await prisma.characterCategory.findUnique({ where: { id: parsed.data.categoryId } }))) return res.status(400).json({ error: "Category not found" });
    const created = await prisma.characterBehavior.create({ data: { ...parsed.data, updatedById: session.user.id }, include: BEHAVIOR_INCLUDE });
    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
