import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseTrainingItem } from "@/lib/training";
import { ITEM_INCLUDE, linkRows, serializeItem, trainingAccess, validPathwayIds } from "@/lib/trainingServer";

/**
 * GET  /api/v1/training/items?centerId=   the Training Library
 * POST /api/v1/training/items { centerId, ...training, pathwayIds }  (admins)
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const centerId = String(req.query.centerId || req.body?.centerId || "");
  const access = await trainingAccess(session, centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.method === "GET") {
    const items = await prisma.trainingItem.findMany({ where: { centerId }, include: ITEM_INCLUDE, orderBy: { title: "asc" } });
    return res.status(200).json(items.map(serializeItem));
  }

  if (req.method === "POST") {
    if (!access.canManage) return res.status(403).json({ error: "Only admins can add trainings" });
    const parsed = parseTrainingItem(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const pathwayIds = await validPathwayIds(centerId, req.body?.pathwayIds);
    const created = await prisma.trainingItem.create({
      data: {
        ...parsed.data,
        centerId,
        createdById: session.user.id,
        pathways: { create: await linkRows(pathwayIds) },
      },
      include: ITEM_INCLUDE,
    });
    return res.status(201).json(serializeItem(created));
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
