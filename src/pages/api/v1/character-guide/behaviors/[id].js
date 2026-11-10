import { getSession } from "@/lib/auth";
import { parseBehavior } from "@/lib/characterGuide";
import prisma from "@/lib/prisma";
import { guideAccountId, guideWhere } from "@/lib/characterGuideServer";
import { EMPLOYEE_ROLES, hasAnyRole } from "@/lib/roles";
import { BEHAVIOR_INCLUDE } from "./index";

/**
 * GET    /api/v1/character-guide/behaviors/:id   staff
 * PUT    /api/v1/character-guide/behaviors/:id   admins (whole behavior)
 * DELETE /api/v1/character-guide/behaviors/:id   admins
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!hasAnyRole(session.user, EMPLOYEE_ROLES)) return res.status(403).json({ error: "Forbidden" });
  // Only behaviors of the user's own account's guide (step D).
  const mine = guideWhere(await guideAccountId(session.user));
  const behavior = await prisma.characterBehavior.findFirst({ where: { id: String(req.query.id), ...mine }, include: BEHAVIOR_INCLUDE });
  if (!behavior) return res.status(404).json({ error: "Behavior not found" });

  if (req.method === "GET") return res.status(200).json(behavior);
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "PUT") {
    const parsed = parseBehavior(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!(await prisma.characterCategory.findFirst({ where: { id: parsed.data.categoryId, ...mine } }))) return res.status(400).json({ error: "Category not found" });
    const updated = await prisma.characterBehavior.update({ where: { id: behavior.id }, data: { ...parsed.data, updatedById: session.user.id }, include: BEHAVIOR_INCLUDE });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await prisma.characterBehavior.delete({ where: { id: behavior.id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  return res.status(405).end();
}
