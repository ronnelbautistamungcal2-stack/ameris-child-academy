import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isChildLinkedToParent } from "@/lib/child-parent-links";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId, parentId } = req.query;

  if (req.method === "GET") {
    if (!["ADMIN", "PARENT"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const where = {};
    if (session.user.role === "PARENT") {
      where.parentId = session.user.id;
    } else {
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      if (parentId) where.parentId = parentId;
      where.activity = { centerId };
    }

    const involvements = await prisma.parentInvolvement.findMany({
      where,
      include: {
        activity: { select: { id: true, title: true } },
        parent: { select: { id: true, name: true, email: true } },
        child: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    return res.status(200).json(involvements);
  }

  if (req.method === "POST") {
    if (session.user.role !== "PARENT") {
      return res.status(403).json({ error: "Only parents can log involvement" });
    }

    const { activityId, childId, notes, occurredAt } = req.body || {};
    if (!activityId) return res.status(400).json({ error: "activityId is required" });

    const activity = await prisma.parentInvolvementActivity.findUnique({ where: { id: activityId } });
    if (!activity || !activity.active) return res.status(404).json({ error: "Activity not found" });

    const ok = await hasAccessToCenter(session.user.id, activity.centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    if (childId) {
      const child = await prisma.child.findUnique({
        where: { id: childId },
        include: { guardians: { select: { guardianId: true } } },
      });
      if (!child || !isChildLinkedToParent(child, session.user.id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const logDate = occurredAt ? new Date(occurredAt) : new Date();
    const record = await prisma.parentInvolvement.create({
      data: {
        activityId,
        parentId: session.user.id,
        childId: childId || null,
        notes: notes || null,
        occurredAt: logDate,
      },
      include: {
        activity: { select: { id: true, title: true } },
        child: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return res.status(201).json(record);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
