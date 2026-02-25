import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { centerId, schoolYear, childId } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    if (session.user.role !== "ADMIN") {
      const hasAccess = await hasAccessToCenter(session.user.id, centerId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const where = { centerId };
    if (schoolYear) where.schoolYear = schoolYear;
    if (childId) where.childId = childId;

    const archives = await prisma.progressArchive.findMany({
      where,
      select: {
        id: true,
        centerId: true,
        childId: true,
        childName: true,
        schoolYear: true,
        archivedAt: true,
        archivedById: true,
      },
      orderBy: { archivedAt: "desc" },
    });

    return res.status(200).json(archives);
  }

  if (req.method === "POST") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create archives" });
    }

    const { centerId, childId, schoolYear } = req.body;
    if (!centerId || !schoolYear) {
      return res.status(400).json({ error: "centerId and schoolYear are required" });
    }

    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

    // Get children to archive
    const childFilter = childId ? { id: childId, centerId } : { centerId };
    const children = await prisma.child.findMany({
      where: childFilter,
      select: { id: true, firstName: true, lastName: true },
    });

    if (children.length === 0) {
      return res.status(400).json({ error: "No children found" });
    }

    const created = [];

    for (const child of children) {
      const progress = await prisma.progress.findMany({
        where: { childId: child.id },
        include: {
          lesson: { include: { category: true, goals: { orderBy: { goalIndex: "asc" } } } },
          lessonGoal: true,
          entries: {
            orderBy: { occurredAt: "desc" },
            include: { recordedBy: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      const data = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        schoolYear,
        child: {
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
        },
        progressRecords: progress.map((pr) => ({
          lesson: {
            title: pr.lesson?.title,
            description: pr.lesson?.description,
            category: pr.lesson?.category?.name || null,
          },
          goalIndex: pr.goalIndex,
          goalTitle: pr.lessonGoal?.title || null,
          status: pr.status,
          achievedAt: pr.achievedAt,
          createdAt: pr.createdAt,
          entries: pr.entries.map((e) => ({
            status: e.status,
            notes: e.notes,
            media: e.media,
            occurredAt: e.occurredAt,
            recordedBy: e.recordedBy?.name || null,
          })),
        })),
      };

      const archive = await prisma.progressArchive.create({
        data: {
          centerId,
          childId: child.id,
          childName: `${child.firstName} ${child.lastName || ""}`.trim(),
          schoolYear,
          archivedById: session.user.id,
          data,
        },
      });

      created.push(archive);
    }

    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
