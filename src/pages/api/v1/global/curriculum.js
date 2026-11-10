import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { ageGroupOptions, curriculumSourceCenter } from "@/lib/curriculumSource";

/**
 * GET /api/v1/global/curriculum
 *     { source: {id,name} | null, ageGroups: [{id,name}], centers: [{id,name,lessons}] }
 *     The Ameris curriculum center (step E), its age groups (classrooms) and
 *     the centers it can be moved to.
 * PUT /api/v1/global/curriculum { sourceCenterId }
 *     Makes another center the curriculum source.
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return undefined;

  if (req.method === "GET") {
    const source = await curriculumSourceCenter();
    const [ageGroups, centers] = await Promise.all([
      ageGroupOptions(prisma, source),
      prisma.center.findMany({
        where: source?.subscriberAccountId ? { subscriberAccountId: source.subscriberAccountId } : {},
        select: { id: true, name: true, _count: { select: { lessons: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    return res.status(200).json({
      source: source ? { id: source.id, name: source.name } : null,
      ageGroups,
      centers: centers.map((c) => ({ id: c.id, name: c.name, lessons: c._count.lessons })),
    });
  }

  if (req.method === "PUT") {
    const id = String(req.body?.sourceCenterId || "");
    const center = id ? await prisma.center.findUnique({ where: { id }, select: { id: true } }) : null;
    if (!center) return res.status(400).json({ error: "Choose a center" });
    await prisma.$transaction([
      prisma.center.updateMany({ where: { curriculumSource: true, NOT: { id } }, data: { curriculumSource: false } }),
      prisma.center.update({ where: { id }, data: { curriculumSource: true } }),
    ]);
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
