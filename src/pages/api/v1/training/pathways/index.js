import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userRoles } from "@/lib/roles";
import { appliesTo, parsePathway, pathwayProgress } from "@/lib/training";
import { loadPathways, loadProgress, trainingAccess } from "@/lib/trainingServer";

/**
 * GET  /api/v1/training/pathways?centerId=[&mine=1]
 *      The pathways with their trainings; with mine=1 only the active ones
 *      that apply to the signed-in user, with their progress.
 * POST /api/v1/training/pathways { centerId, ...pathway }  (admins)
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const centerId = String(req.query.centerId || req.body?.centerId || "");
  const access = await trainingAccess(session, centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.method === "GET") {
    let pathways = await loadPathways(centerId);
    if (req.query.mine === "1") {
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, roles: true } });
      const roles = userRoles(me);
      pathways = pathways.filter((p) => p.active && appliesTo(p, roles));
      const progress = (await loadProgress([session.user.id], pathways.flatMap((p) => p.items.map((i) => i.id))))[session.user.id] || {};
      pathways = pathways.map((p) => ({ ...p, myProgress: pathwayProgress(p.items.map((i) => i.id), progress) }));
    }
    return res.status(200).json({ pathways, canManage: access.canManage });
  }

  if (req.method === "POST") {
    if (!access.canManage) return res.status(403).json({ error: "Only admins can add pathways" });
    const parsed = parsePathway(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const created = await prisma.teacherTrainingPathway.create({
      data: { ...parsed.data, centerId, createdById: session.user.id, updatedById: session.user.id },
    });
    return res.status(201).json({ id: created.id });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
