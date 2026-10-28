import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parsePathway } from "@/lib/training";
import { centerStaff, loadPathways, loadProgress, staffProgressRows, trainingAccess } from "@/lib/trainingServer";

/**
 * GET    /api/v1/training/pathways/:id   the pathway, its trainings, the
 *        viewer's own progress per training and (for admins, coaches and HR)
 *        the assigned staff with their progress.
 * PUT    /api/v1/training/pathways/:id { ...pathway, itemIds? }  (admins)
 * DELETE /api/v1/training/pathways/:id                            (admins)
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const row = await prisma.teacherTrainingPathway.findUnique({ where: { id: String(req.query.id) }, select: { id: true, centerId: true } });
  if (!row) return res.status(404).json({ error: "Pathway not found" });
  const access = await trainingAccess(session, row.centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.method === "GET") {
    const [pathway] = await loadPathways(row.centerId, { id: row.id });
    const itemIds = pathway.items.map((i) => i.id);
    const staff = access.canTrack ? await centerStaff(row.centerId) : [];
    const progress = await loadProgress([session.user.id, ...staff.map((s) => s.id)], itemIds);
    const mine = progress[session.user.id] || {};
    return res.status(200).json({
      pathway: {
        ...pathway,
        items: pathway.items.map((i) => ({ ...i, myProgress: mine[i.id] || null })),
      },
      assignedStaff: access.canTrack ? staffProgressRows(staff, [{ ...pathway, active: true }], progress) : [],
      itemProgress: access.canTrack
        ? Object.fromEntries(staff.map((s) => [s.id, Object.fromEntries(itemIds.map((id) => [id, progress[s.id]?.[id] || null]))]))
        : {},
      canManage: access.canManage,
      canTrack: access.canTrack,
      canSignOff: ["ADMIN", "COACH"].includes(session.user.role),
    });
  }

  if (!access.canManage) return res.status(403).json({ error: "Only admins can change pathways" });

  if (req.method === "PUT") {
    const parsed = parsePathway(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    await prisma.teacherTrainingPathway.update({ where: { id: row.id }, data: { ...parsed.data, updatedById: session.user.id } });
    if (Array.isArray(req.body?.itemIds)) {
      const ids = req.body.itemIds.map(String);
      const valid = new Set((await prisma.trainingItem.findMany({ where: { centerId: row.centerId, id: { in: ids } }, select: { id: true } })).map((i) => i.id));
      await prisma.trainingPathwayItem.deleteMany({ where: { pathwayId: row.id, trainingItemId: { notIn: [...valid] } } });
      for (const [i, id] of ids.filter((x) => valid.has(x)).entries()) {
        await prisma.trainingPathwayItem.upsert({
          where: { pathwayId_trainingItemId: { pathwayId: row.id, trainingItemId: id } },
          update: { sortOrder: i },
          create: { pathwayId: row.id, trainingItemId: id, sortOrder: i },
        });
      }
    }
    return res.status(200).json({ id: row.id });
  }

  if (req.method === "DELETE") {
    await prisma.teacherTrainingPathway.delete({ where: { id: row.id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  return res.status(405).end();
}
