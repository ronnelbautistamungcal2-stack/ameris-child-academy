import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userRoles } from "@/lib/roles";
import { appliesTo } from "@/lib/training";
import { ITEM_INCLUDE, loadPathways, serializeItem, trainingAccess } from "@/lib/trainingServer";

/**
 * GET /api/v1/training/my?centerId=
 * My Training: the library trainings that apply to the signed-in user (by
 * role, or through a pathway that applies to them) with their progress.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerId = String(req.query.centerId || "");
  const access = await trainingAccess(session, centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, roles: true } });
  const roles = userRoles(me);
  const [items, pathways] = await Promise.all([
    prisma.trainingItem.findMany({ where: { centerId }, include: ITEM_INCLUDE, orderBy: [{ dueDate: "asc" }, { title: "asc" }] }),
    loadPathways(centerId, { active: true }),
  ]);
  const viaPathway = new Set(pathways.filter((p) => appliesTo(p, roles)).flatMap((p) => p.items.map((i) => i.id)));
  const mine = items.filter((i) => appliesTo(i, roles) || viaPathway.has(i.id));
  const progress = await prisma.trainingProgress.findMany({ where: { userId: session.user.id, trainingItemId: { in: mine.map((i) => i.id) } } });
  const byItem = Object.fromEntries(progress.map((p) => [p.trainingItemId, p]));
  return res.status(200).json(mine.map((i) => ({ ...serializeItem(i), myProgress: byItem[i.id] || null })));
}
