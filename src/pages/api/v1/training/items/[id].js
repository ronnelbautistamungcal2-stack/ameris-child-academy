import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseTrainingItem } from "@/lib/training";
import { ITEM_INCLUDE, linkRows, serializeItem, trainingAccess, validPathwayIds } from "@/lib/trainingServer";

/**
 * PUT    /api/v1/training/items/:id { ...training, pathwayIds? }  (admins)
 * DELETE /api/v1/training/items/:id                              (admins)
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const item = await prisma.trainingItem.findUnique({ where: { id: String(req.query.id) }, include: ITEM_INCLUDE });
  if (!item) return res.status(404).json({ error: "Training not found" });
  const access = await trainingAccess(session, item.centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.method === "GET") return res.status(200).json(serializeItem(item));
  if (!access.canManage) return res.status(403).json({ error: "Only admins can change trainings" });

  if (req.method === "PUT") {
    const parsed = parseTrainingItem(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (Array.isArray(req.body?.pathwayIds)) {
      const wanted = await validPathwayIds(item.centerId, req.body.pathwayIds);
      const current = item.pathways.map((p) => p.pathway.id);
      await prisma.trainingPathwayItem.deleteMany({ where: { trainingItemId: item.id, pathwayId: { notIn: wanted } } });
      const added = wanted.filter((id) => !current.includes(id));
      for (const row of await linkRows(added)) await prisma.trainingPathwayItem.create({ data: { ...row, trainingItemId: item.id } });
    }
    const updated = await prisma.trainingItem.update({ where: { id: item.id }, data: parsed.data, include: ITEM_INCLUDE });
    return res.status(200).json(serializeItem(updated));
  }

  if (req.method === "DELETE") {
    await prisma.trainingItem.delete({ where: { id: item.id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  return res.status(405).end();
}
