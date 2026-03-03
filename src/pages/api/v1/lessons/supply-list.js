import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { centerId, lessonIds } = req.query;

  if (!centerId && !lessonIds) {
    return res.status(400).json({ error: "centerId or lessonIds is required" });
  }

  if (centerId && session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  const where = {};
  if (centerId) where.lesson = { centerId };
  if (lessonIds) {
    const ids = lessonIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length) {
      where.lessonId = { in: ids };
    }
  }

  const supplies = await prisma.lessonSupply.findMany({
    where,
    include: { lesson: { select: { id: true, title: true } } },
    orderBy: { name: "asc" },
  });

  // Aggregate by name + unit
  const aggregated = {};
  for (const s of supplies) {
    const key = `${s.name.toLowerCase()}|${(s.unit || "").toLowerCase()}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        name: s.name,
        unit: s.unit,
        totalQuantity: 0,
        estimatedCost: 0,
        category: s.category,
        lessons: [],
      };
    }
    aggregated[key].totalQuantity += s.quantity;
    aggregated[key].estimatedCost += s.estimatedCost || 0;
    aggregated[key].lessons.push({ id: s.lesson.id, title: s.lesson.title });
  }

  return res.status(200).json(Object.values(aggregated));
}
